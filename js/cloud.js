/* ==========================================================================
   GLT Fireworks - cloud layer (Supabase)

   Replaces the old Google Apps Script backend. It keeps the same "actions"
   and reply shapes the app already uses (apiCall / getData / reservations /
   bill locks), so the business logic in app.js is unchanged.

   Built for a weak internet connection:
     * every request has a time limit, so the screen never hangs;
     * changes that can't be uploaded are kept on this device (the "outbox")
       and re-sent automatically when the connection returns;
     * product/customer refreshes ask the server only for what changed.
   ========================================================================== */
var GLTCloud = (function () {
  'use strict';

  var CFG = window.GLT_CONFIG || {};
  var sb = null;              // supabase client
  var profile = null;         // { id, username, role, active }
  var accessToken = '';       // kept fresh by onAuthStateChange (used by unload requests)
  var OUTBOX_KEY = 'cloudOutbox';
  var PROFILE_KEY = 'cloudProfile';
  var BILLS_SYNC_KEY = 'cloudBillsSync';
  var QUEUEABLE = { updateStock: 1, updateProduct: 1, updateProductPrice: 1, saveBill: 1,
                    addCustomer: 1, addReference: 1, addRefPricesToSheet: 1 };

  // ---- tiny local-storage helpers (independent of app.js) ------------------
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  // ---- setup ---------------------------------------------------------------
  function configured() { return !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY); }

  function configHelp() {
    if (!configured()) return 'Cloud is not set up yet. Fill in js/supabase-config.js (see supabase/SETUP-GUIDE.html).';
    if (!window.supabase || !window.supabase.createClient) return 'The Supabase library (js/vendor/supabase.js) did not load. Make sure the js/vendor folder was uploaded with the site, then reload.';
    return '';
  }

  // Requests never hang forever on a poor connection.
  function timedFetch(url, opts) {
    var ms = /\/storage\//.test(String(url)) ? 90000 : 25000;
    if (typeof AbortController === 'undefined') return fetch(url, opts);
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, ms);
    var o = Object.assign({}, opts || {});
    if (o.signal) {
      var outer = o.signal;
      if (outer.aborted) ctrl.abort(); else outer.addEventListener('abort', function () { ctrl.abort(); });
    }
    o.signal = ctrl.signal;
    return fetch(url, o).then(function (r) { clearTimeout(timer); return r; },
                              function (e) { clearTimeout(timer); throw e; });
  }

  function init() {
    if (sb) return true;
    if (configHelp()) return false;
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'glt-auth' },
      global: { fetch: timedFetch }
    });
    sb.auth.onAuthStateChange(function (ev, session) { accessToken = session ? session.access_token : ''; });
    return true;
  }

  function ready() { return init(); }
  function signedIn() { return !!profile; }

  // ---- errors --------------------------------------------------------------
  function isNetErr(e) {
    if (!e) return false;
    if (e.isNetwork) return true;
    var name = String(e.name || '');
    if (name === 'AuthRetryableFetchError' || name === 'AbortError') return true;
    if (e.status === 0) return true;
    var code = e.code ? String(e.code) : '';
    if (code && !/^(abort|fetch|econn|etimedout)/i.test(code)) return false;   // a real database/permission error
    return /failed to fetch|networkerror|network request failed|load failed|fetch|abort|timed? ?out|offline/i.test(String(e.message || e));
  }
  function toError(e) {
    var er = new Error((e && e.message) || 'Request failed');
    er.code = (e && e.code) || '';
    er.isNetwork = isNetErr(e);
    return er;
  }
  function errText(e) {
    if (isNetErr(e)) return 'No internet connection right now';
    var m = String((e && e.message) || e || 'Request failed');
    if (/jwt|expired|not authenticated/i.test(m)) return 'Your session expired - please log out and log in again';
    return m;
  }
  function rpc(name, args) {
    if (!sb && !init()) return Promise.reject(new Error(configHelp() || 'Cloud not available'));
    return sb.rpc(name, args || {}).then(function (r) {
      if (r.error) throw toError(r.error);
      return r.data;
    });
  }

  // ---- login / session -----------------------------------------------------
  function emailFor(username) {
    var u = String(username || '').trim().toLowerCase();
    if (u.indexOf('@') > 0) return u;                                  // a full e-mail was typed
    var base = String(CFG.LOGIN_EMAIL_BASE || '').trim().toLowerCase();
    var at = base.indexOf('@');
    if (at > 0) return base.slice(0, at) + '+' + u + base.slice(at);   // you+siva@gmail.com
    return u + '@' + (CFG.LOGIN_EMAIL_DOMAIN || 'glt-fireworks.app');
  }
  function cachedProfile() { return lsGet(PROFILE_KEY, null); }
  function hasStoredSession() { try { return !!localStorage.getItem('glt-auth'); } catch (e) { return false; } }

  function loadProfile() {
    return rpc('my_profile').then(function (p) {
      if (!p) throw new Error('This login has no staff profile yet. Ask the admin.');
      if (!p.active) throw new Error('This account is disabled. Ask the admin.');
      profile = p;
      lsSet(PROFILE_KEY, p);
      return p;
    });
  }

  function signIn(username, password) {
    if (!init()) return Promise.reject(new Error(configHelp()));
    return sb.auth.signInWithPassword({ email: emailFor(username), password: password }).then(function (r) {
      if (r.error) {
        var e = new Error(isNetErr(r.error) ? 'No internet connection - the first login needs internet.'
                          : (/invalid login/i.test(r.error.message) ? 'Invalid username or password.' : r.error.message));
        e.isNetwork = isNetErr(r.error);
        throw e;
      }
      accessToken = r.data && r.data.session ? r.data.session.access_token : accessToken;
      return loadProfile().catch(function (e2) { sb.auth.signOut({ scope: 'local' }); throw e2; });
    });
  }

  // Instant (no network): the profile remembered on this device, if a login session is stored.
  function quickRestore() {
    if (!configured()) return null;      // (works even if the Supabase library itself could not be loaded)
    var cp = cachedProfile();
    if (cp && hasStoredSession()) { profile = cp; return cp; }
    return null;
  }

  // Called when the page opens. Resolves with the profile if a login is remembered
  // on this device (works offline too), otherwise null.
  function restore() {
    if (!init()) return Promise.resolve(null);
    function offlineFallback() {
      var cp = cachedProfile();
      if (cp && hasStoredSession()) { profile = cp; return cp; }
      return null;
    }
    return sb.auth.getSession().then(function (r) {
      var s = r && r.data && r.data.session;
      if (s) {
        accessToken = s.access_token;
        return loadProfile().catch(function (e) { if (isNetErr(e)) { return offlineFallback(); } throw e; });
      }
      if (r && r.error && isNetErr(r.error)) return offlineFallback();
      return null;
    }).catch(function (e) {
      if (isNetErr(e)) return offlineFallback();
      throw e;
    });
  }

  function signOut() {
    profile = null; accessToken = '';
    lsDel(PROFILE_KEY);
    if (sb) { try { sb.auth.signOut({ scope: 'local' }); } catch (e) {} }
    lsDel('glt-auth');      // always forget the saved login, even if the sign-out request could not reach the server
  }

  function changePassword(newPassword) {
    if (!init()) return Promise.reject(new Error(configHelp()));
    return sb.auth.updateUser({ password: newPassword }).then(function (r) {
      if (r.error) throw toError(r.error);
      return true;
    });
  }

  // ---- product helpers -----------------------------------------------------
  function pid(p) { return String(p && p._id != null ? p._id : (p && p.id != null ? p.id : '')); }
  function stablePrices(pr) {
    var out = {}; Object.keys(pr || {}).sort().forEach(function (k) { if (pr[k] != null) out[k] = pr[k]; });
    return JSON.stringify(out);
  }
  function productSig(p) {
    return JSON.stringify([p.name || '', p.category || '', p.uom || '', p.qtyPerCase == null ? null : Number(p.qtyPerCase),
                           Number(p.stockCases) || 0, Number(p.stockLoose) || 0, stablePrices(p.prices)]);
  }
  function mapProduct(p) {
    var o = { _id: pid(p), name: p.name, category: p.category, uom: p.uom, qtyPerCase: p.qtyPerCase,
              stockCases: p.stockCases, stockLoose: p.stockLoose, stock: p.stock, prices: p.prices || {} };
    if (profile && profile.role === 'admin') o.costPrice = p.costPrice;
    return o;
  }
  function sortProducts(arr) {
    return arr.sort(function (a, b) {
      var na = /^\d+$/.test(a._id) ? Number(a._id) : null, nb = /^\d+$/.test(b._id) ? Number(b._id) : null;
      if (na != null && nb != null) return na - nb;
      if (na != null) return -1;
      if (nb != null) return 1;
      return String(a.name).localeCompare(String(b.name));
    });
  }

  var cache = { products: null, serverTime: null, sig: {} };

  // Changes made on this device that are still waiting to upload must not be
  // undone by a refresh from the cloud, so they are laid over what comes back.
  function overlayPending(products, customers) {
    var box = lsGet(OUTBOX_KEY, []);
    if (!box.length) return;
    var byId = {};
    products.forEach(function (p) { byId[p._id] = p; });
    box.forEach(function (e) {
      var d = e.data || {};
      if (e.action === 'updateStock') {
        (d.products || []).forEach(function (q) {
          var p = byId[pid(q)]; if (!p) return;
          p.stockCases = q.stockCases; p.stockLoose = q.stockLoose; p.stock = q.stock;
          if (q.prices) p.prices = Object.assign({}, p.prices || {}, q.prices);
        });
      } else if (e.action === 'updateProduct' && d.product) {
        var p2 = byId[pid(d.product)];
        if (p2) Object.keys(d.product).forEach(function (k) { p2[k] = d.product[k]; });
      } else if (e.action === 'updateProductPrice') {
        var p3 = byId[String(d.productId)];
        if (p3) { p3.prices = Object.assign({}, p3.prices || {}); p3.prices[String(d.refId)] = d.price; }
      } else if (e.action === 'addCustomer' && d.customer && customers) {
        var at = -1;
        customers.forEach(function (c, i) { if (String(c._id) === String(d.customer._id)) at = i; });
        if (at >= 0) customers[at] = d.customer; else customers.push(d.customer);
      }
    });
  }

  function backOff(t) { return new Date(new Date(t).getTime() - 2000).toISOString(); }   // 2 s safety margin

  // Everything the app needs.  opts: { delta, includeBills, allBills }
  //   delta        -> only ask for products/customers changed since the last call
  //   includeBills -> also fetch estimates (only the new ones unless allBills)
  function getData(opts) {
    opts = opts || {};
    if (!init()) return Promise.reject(new Error(configHelp()));
    var delta = !!(opts.delta && cache.products && cache.serverTime);
    var args = { p_include_bills: !!opts.includeBills };
    if (delta) args.p_since = cache.serverTime;
    if (opts.includeBills && !opts.allBills) {
      var bs = lsGet(BILLS_SYNC_KEY, null);
      if (bs) args.p_bills_since = bs;
    }
    return rpc('get_app_data', args).then(function (d) {
      d = d || {};
      var products;
      if (delta) {
        var byId = {};
        cache.products.forEach(function (p) { byId[p._id] = p; });
        (d.products || []).forEach(function (p) { byId[p._id] = p; });
        var keep = null;
        if (d.all_product_ids) { keep = {}; d.all_product_ids.forEach(function (i) { keep[String(i)] = 1; }); }
        products = Object.keys(byId).filter(function (k) { return !keep || keep[k]; }).map(function (k) { return byId[k]; });
        sortProducts(products);
      } else {
        products = d.products || [];
      }
      cache.products = products;
      cache.serverTime = d.server_time ? backOff(d.server_time) : null;
      (d.products || []).forEach(function (p) { cache.sig[p._id] = productSig(p); });
      if (opts.includeBills && d.server_time) lsSet(BILLS_SYNC_KEY, backOff(d.server_time));
      // hand out copies, with our own not-yet-uploaded changes laid over them
      var outProducts = JSON.parse(JSON.stringify(products));
      var outCustomers = JSON.parse(JSON.stringify(d.customers || []));
      overlayPending(outProducts, outCustomers);
      return { status: 'success', products: outProducts, customers: outCustomers, bills: d.bills || [],
               references: d.references || [], settings: d.settings || {} };
    });
  }

  function pushProducts(list, force) {
    var items = [];
    (list || []).forEach(function (p) {
      if (!p) return;
      var id = pid(p);
      if (!force && id && cache.sig[id] === productSig(p)) return;    // server already has exactly this
      items.push(p);
    });
    if (!items.length) return Promise.resolve({ updated: 0, added: 0, skipped: (list || []).length });
    var chunks = [];
    for (var i = 0; i < items.length; i += 150) chunks.push(items.slice(i, i + 150));
    var total = { updated: 0, added: 0 };
    return chunks.reduce(function (chain, chunk) {
      return chain.then(function () {
        return rpc('push_products', { p_items: chunk.map(mapProduct) }).then(function (r) {
          r = r || {}; total.updated += r.updated || 0; total.added += r.added || 0;
          chunk.forEach(function (p) { cache.sig[pid(p)] = productSig(p); });
        });
      });
    }, Promise.resolve()).then(function () { return total; });
  }

  // ---- PDF files (estimate / statement links for WhatsApp) -----------------
  function safeName(s) { return String(s || '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'file'; }
  function randomToken() {
    try { var a = new Uint8Array(9); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
    catch (e) { return Math.random().toString(36).slice(2, 12) + Date.now().toString(36); }
  }
  function uploadPdf(path, blob) {
    return sb.storage.from('bill-pdfs').upload(path, blob, { contentType: 'application/pdf', upsert: true, cacheControl: '60' })
      .then(function (r) {
        if (r.error) throw toError(r.error);
        return sb.storage.from('bill-pdfs').getPublicUrl(path).data.publicUrl;
      });
  }
  function makePdf(html) {
    if (typeof loadPdfLibs !== 'function' || typeof renderHtmlToPdfBlob !== 'function') return Promise.reject(new Error('PDF tools not available'));
    return loadPdfLibs().then(function () { return renderHtmlToPdfBlob(html); });
  }

  // ---- the "actions" (same names the app already uses) ---------------------
  function execute(action, d) {
    d = d || {};
    switch (action) {
      case 'updateStock':
        return pushProducts(d.products || [], !!d.force).then(function (r) {
          return { status: 'success', message: 'Stock synced: ' + r.updated + ' updated, ' + r.added + ' added.', updated: r.updated, added: r.added };
        });
      case 'updateProduct':
        return rpc('update_product', { p_item: mapProduct(d.product || {}) }).then(function () {
          if (d.product) cache.sig[pid(d.product)] = productSig(d.product);
          return { status: 'success' };
        });
      case 'addProduct':
        return rpc('create_product', { p_item: mapProduct(d.product || {}) }).then(function (r) { return { status: 'success', id: r && r.id }; });
      case 'deleteProduct':
        return rpc('delete_product', { p_id: String(d.productId) }).then(function () { delete cache.sig[String(d.productId)]; return { status: 'success' }; });
      case 'updateProductPrice':
        return rpc('set_product_price', { p_id: d.productId != null ? String(d.productId) : null, p_name: d.productName || null,
                                          p_ref: String(d.refId), p_price: d.price == null ? null : Number(d.price) })
          .then(function () { return { status: 'success' }; });
      case 'addCustomer':
        return rpc('save_customer', { p_customer: d.customer || {} }).then(function () { return { status: 'success' }; });
      case 'addReference':
        return rpc('save_reference', { p_id: String(d.refId), p_name: d.name || '', p_base: d.baseRefId != null ? String(d.baseRefId) : null })
          .then(function () { return { status: 'success' }; });
      case 'addRefPricesToSheet': {
        var ref = String(d.refId), items = [];
        (d.products || []).forEach(function (p) {
          if (p && p.prices && p.prices[ref] != null) items.push({ id: pid(p), price: Number(p.prices[ref]) });
        });
        return rpc('set_ref_prices', { p_ref: ref, p_items: items }).then(function (r) {
          return { status: 'success', written: r && r.written };
        });
      }
      case 'saveBill': {
        var bill = d.bill || {};
        var billId = String(bill._id || bill.billNumber || '');
        return rpc('save_bill', { p_bill: bill }).then(function () {
          if (!d.htmlContent) return { status: 'success' };
          var base = safeName(bill.customerName) + '_' + safeName(bill.billNumber);
          return makePdf(d.htmlContent)
            .then(function (blob) { return uploadPdf('bills/' + safeName(billId) + '/' + base + '.pdf', blob); })
            .then(function (url) { return rpc('set_bill_pdf', { p_bill_id: billId, p_url: url }).then(function () { return { status: 'success', fileUrl: url }; }); })
            .catch(function (err) {
              return { status: 'success', warning: 'Estimate saved, but the PDF link could not be created (' + errText(err) + ').' };
            });
        });
      }
      case 'saveCustomerStatement': {
        var d0 = new Date(), dc = ('0' + d0.getDate()).slice(-2) + ('0' + (d0.getMonth() + 1)).slice(-2) + String(d0.getFullYear()).slice(-2);
        var fileName = safeName(d.customerName) + '_' + dc + '_Statement.pdf';
        return makePdf(d.htmlContent).then(function (blob) {
          return uploadPdf('statements/' + randomToken() + '/' + fileName, blob);
        }).then(function (url) {
          return { status: 'success', fileUrl: url, downloadUrl: url + '?download=' + encodeURIComponent(fileName), fileName: fileName };
        });
      }
      case 'smartSync': {
        var synced = {};
        return pushProducts(d.products || d.stock || [], false).then(function (r) {
          synced.stock = r.updated + r.added;
          var custs = (d.customers || []).filter(function (c) { return c && (c._id || c.id); });
          return custs.reduce(function (chain, c) {
            return chain.then(function () { return rpc('save_customer', { p_customer: c }); });
          }, Promise.resolve()).then(function () { synced.customers = custs.length; });
        }).then(function () {
          var last = lsGet('cloudSmartSync', 0);
          var bl = (d.bills || (d.bill ? [d.bill] : [])).filter(function (b) {
            var t = new Date(b.updatedAt || b.date || 0).getTime();
            return !last || t >= last;
          });
          return bl.reduce(function (chain, b) {
            return chain.then(function () { return rpc('save_bill', { p_bill: b }); });
          }, Promise.resolve()).then(function () { synced.bills = bl.length; lsSet('cloudSmartSync', Date.now() - 60000); });
        }).then(function () { return { status: 'success', synced: synced }; });
      }
      case 'reserve':
        return rpc('reserve_stock', { p_product: String(d.productId), p_session: d.sessionId || '', p_qty: Number(d.qty) || 0 })
          .then(function () { return { status: 'success' }; });
      case 'release':
        return rpc('release_reservation', { p_product: String(d.productId), p_session: d.sessionId || '' })
          .then(function () { return { status: 'success' }; });
      case 'releaseAll':
        return rpc('release_all_reservations', { p_session: d.sessionId || '' }).then(function () { return { status: 'success' }; });
      case 'acquireBillLock':
        return rpc('acquire_bill_lock', { p_bill: String(d.billId), p_session: d.sessionId || '', p_user: d.username || '' });
      case 'releaseBillLock':
        return rpc('release_bill_lock', { p_bill: String(d.billId), p_session: d.sessionId || '' })
          .then(function () { return { status: 'success' }; });
      case 'addUser':
      case 'deleteUser':
        return Promise.resolve({ status: 'error', message: 'Staff logins are now managed in Settings -> Users and the Supabase dashboard.' });
      default:
        return Promise.resolve({ status: 'error', message: 'Unknown action: ' + action });
    }
  }

  // ---- outbox: changes waiting for a connection ---------------------------
  function outbox() { return lsGet(OUTBOX_KEY, []); }
  function saveOutbox(b) { lsSet(OUTBOX_KEY, b); paintBadge(); }
  function outboxCount() { return outbox().length; }
  // ids of estimates that still have unsent changes on this device (a refresh must not overwrite them)
  function pendingBillIds() {
    var m = {};
    outbox().forEach(function (e) {
      if (e.action === 'saveBill' && e.data && e.data.bill) m[String(e.data.bill._id || e.data.bill.billNumber)] = 1;
    });
    return m;
  }

  function queueKey(action, d) {
    switch (action) {
      case 'saveBill': return 'bill:' + ((d.bill && (d.bill._id || d.bill.billNumber)) || '');
      case 'addCustomer': return 'cust:' + ((d.customer && (d.customer._id || d.customer.id)) || '');
      case 'updateProduct': return 'prod:' + pid(d.product || {});
      case 'updateProductPrice': return 'price:' + d.productId + ':' + d.refId;
      case 'addReference': return 'ref:' + d.refId;
      case 'addRefPricesToSheet': return 'refprices:' + d.refId;
      default: return null;
    }
  }
  function enqueue(action, d) {
    var box = outbox();
    var copy = JSON.parse(JSON.stringify(d || {}));
    delete copy.htmlContent;                        // the PDF is made later, when someone shares the link
    if (action === 'updateStock') {
      var existing = null;
      box.forEach(function (e) { if (e.action === 'updateStock') existing = e; });
      if (existing) {
        var m = {}; (existing.data.products || []).forEach(function (p) { m[pid(p)] = p; });
        (copy.products || []).forEach(function (p) { m[pid(p)] = p; });
        existing.data.products = Object.keys(m).map(function (k) { return m[k]; });
        saveOutbox(box); return;
      }
    }
    var key = queueKey(action, copy);
    if (key) box = box.filter(function (e) { return e.key !== key; });
    box.push({ action: action, data: copy, key: key, ts: Date.now() });
    saveOutbox(box);
  }

  var flushing = false;
  function flush() {
    if (flushing || !ready() || !profile) return Promise.resolve(false);
    if (!outbox().length) return Promise.resolve(true);
    flushing = true;
    function step() {
      var box = outbox();
      if (!box.length) { flushing = false; return Promise.resolve(true); }
      var head = box[0];
      function dropHead() { var b = outbox(); if (b.length && b[0].ts === head.ts && b[0].action === head.action) b.shift(); saveOutbox(b); }
      return execute(head.action, head.data).then(function () { dropHead(); return step(); }, function (err) {
        if (isNetErr(err)) { flushing = false; return false; }              // still offline: try again later
        console.warn('Dropping an upload the server refused:', head.action, err && err.message);
        dropHead(); lastFlushError = errText(err); return step();
      });
    }
    return step().then(function (r) { flushing = false; return r; }, function () { flushing = false; return false; });
  }
  var lastFlushError = '';

  function paintBadge() {
    var el = document.getElementById('sync-queue-badge');
    if (!el) return;
    var n = outboxCount();
    el.style.display = n ? 'inline-flex' : 'none';
    el.textContent = n ? ('⏳ ' + n + ' waiting to upload') : '';
    el.title = n ? 'These changes are saved on this device and will upload automatically when the internet is back. Click to try now.' : '';
  }

  // Same signature as the old apiCall(action, data, cb).
  function call(action, data, cb) {
    data = data || {};
    if (!init()) {
      // Signed in on this device but the Supabase library could not be loaded (no internet):
      // keep the change and upload it the next time the app opens with a connection.
      if (profile && QUEUEABLE[action]) {
        enqueue(action, data);
        if (cb) cb({ status: 'success', queued: true, warning: 'No internet - saved on this device, it will upload automatically.' });
      } else if (cb) cb({ status: 'error', message: configHelp() || 'Cloud not available', offline: true });
      return;
    }
    execute(action, data).then(function (res) {
      if (cb) cb(res);
      if (outbox().length) flush();                  // connection works -> send anything that was waiting
    }, function (err) {
      if (isNetErr(err) && QUEUEABLE[action]) {
        enqueue(action, data);
        if (cb) cb({ status: 'success', queued: true, warning: 'No internet - saved on this device, it will upload automatically.' });
      } else if (isNetErr(err) && (action === 'acquireBillLock' || action === 'releaseBillLock' || action === 'reserve' || action === 'release' || action === 'releaseAll')) {
        if (cb) cb({ status: 'success', offline: true });   // nothing to protect while offline
      } else if (cb) cb({ status: 'error', message: errText(err), offline: isNetErr(err) });
    });
  }

  function getReservations() {
    return rpc('get_reservations').then(function (r) { return { status: 'success', reservations: r || {} }; });
  }
  function getBillLocks() {
    return rpc('get_bill_locks').then(function (r) { return { status: 'success', locks: r || {} }; });
  }

  // "Release my reservations/locks" while the page is closing (a normal request would be cancelled).
  function releaseOnUnload(sessionId, billId) {
    if (!CFG.SUPABASE_URL || !accessToken) return;
    function send(fn, args) {
      try {
        fetch(CFG.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
          method: 'POST', keepalive: true,
          headers: { 'Content-Type': 'application/json', apikey: CFG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + accessToken },
          body: JSON.stringify(args)
        });
      } catch (e) {}
    }
    if (sessionId) send('release_all_reservations', { p_session: sessionId });
    if (sessionId && billId) send('release_bill_lock', { p_bill: String(billId), p_session: sessionId });
  }

  // ---- price password + staff (admin) --------------------------------------
  function verifyPricePassword(pw) { return rpc('verify_price_password', { p_password: pw }); }
  function setPricePassword(pw) { return rpc('set_price_password', { p_password: pw }); }
  function listStaff() { return rpc('list_staff'); }
  function setStaffRole(id, role) { return rpc('set_staff_role', { p_id: id, p_role: role }); }
  function setStaffActive(id, active) { return rpc('set_staff_active', { p_id: id, p_active: !!active }); }

  function test() {
    if (!init()) return Promise.reject(new Error(configHelp()));
    return rpc('my_profile').then(function (p) {
      if (!p) throw new Error('Signed in, but no staff profile found');
      return { status: 'success', message: 'Connected to Supabase as ' + p.username + ' (' + p.role + ')' };
    });
  }

  // background retry
  setInterval(function () { if (profile && outbox().length) flush(); }, 30000);
  window.addEventListener('online', function () { flush(); });
  if (document.readyState !== 'loading') paintBadge(); else document.addEventListener('DOMContentLoaded', paintBadge);

  return {
    configured: configured, configHelp: configHelp, ready: ready, signedIn: signedIn,
    profile: function () { return profile; },
    signIn: signIn, signOut: signOut, restore: restore, quickRestore: quickRestore, changePassword: changePassword, emailFor: emailFor,
    getData: getData, call: call, getReservations: getReservations, getBillLocks: getBillLocks,
    releaseOnUnload: releaseOnUnload, verifyPricePassword: verifyPricePassword, setPricePassword: setPricePassword,
    listStaff: listStaff, setStaffRole: setStaffRole, setStaffActive: setStaffActive,
    outboxCount: outboxCount, pendingBillIds: pendingBillIds, flush: flush, paintBadge: paintBadge, test: test,
    isNetworkError: isNetErr, errorText: errText,
    lastFlushError: function () { return lastFlushError; },
    // exposed for tests
    _internals: { execute: execute, cache: cache, productSig: productSig, outbox: outbox, enqueue: enqueue }
  };
})();
