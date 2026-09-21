/* ==========================================================================
   GLT Fireworks - application logic
   (extracted unchanged from the original single-file page; only inline
   style strings were retuned for the new look)
   ========================================================================== */
// Shown on the Home page so it's easy to tell which copy of the code is running.
// Keep in step with the ?v= tags in GLT_Fireworks_NEW.html.
var APP_VERSION='20260921-8';

// == STORAGE ==
function lsGet(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}

// == REFERENCE PRICE LISTS ==
var REF_MAP = lsGet('refMap', DEFAULT_REF_MAP);
var REF_LIST = [];
function rebuildRefList(){ REF_LIST = Object.entries(REF_MAP).map(([id,name])=>({id,name})); }
rebuildRefList();

// == STATE ==
var theme = lsGet('theme', 'dark');
var userRole = lsGet('userRole', 'admin');
document.documentElement.setAttribute('data-theme', theme);

function toggleTheme() {
  theme = theme === 'dark' ? 'light' : 'dark';
  lsSet('theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  toast('Theme switched to ' + theme + ' mode');
}

var lang=lsGet('lang','en');
var products=lsGet('products',[]);
if(!products||products.length===0){
  if(typeof ALL_PRODUCTS!=='undefined') products=ALL_PRODUCTS.slice();
}
// Ensure all product _ids are strings (mixed types cause === comparison failures)
products.forEach(function(p){
  if (p._id != null) p._id = String(p._id);
  if (p.id != null) p.id = String(p.id);
});
// Recalculate total stock for all products using the correct formula:
// Total Stock = (QTY Per Case * Cases In Stock) + Loose Pieces
products.forEach(function(p){
  var qpc = p.qtyPerCase || 0;
  var cases = p.stockCases || 0;
  var loose = p.stockLoose || 0;
  p.stock = (qpc * cases) + loose;
});
var customers=lsGet('customers',[]);
var bills=lsGet('bills',[]);
var curTab='home';
var billItems=[];
var billCustomer='';
var billCustomerId='';
var billRef='';
var selectedProduct=null;
var qtyMode='cases';
var invSearch='';
var stkSearch='';
var appSettings = lsGet('appSettings', {}); // loaded from Settings_Db sheet
var invFilter='all';
var invPage=1;
var billItemSearch='';
var priceLookupSearch='';
var priceLookupRefs=['','',''];
var INV_PER=48;
var histSearch='';
var settingsTab='general';

// == HELPERS ==
function fmtMoney(n){return String.fromCharCode(8377)+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtNum(n){return Number(n||0).toLocaleString('en-IN');}
function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2);}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function cleanKey(str){if(!str)return"";return String(str).replace(/&quot;/gi,'"').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').toLowerCase().replace(/[^a-z0-9]/gi,'');}
function getProductQtyFromItems(itemsList, product) {
  if (!itemsList || !Array.isArray(itemsList)) return 0;
  var nameCk = cleanKey(product.name);
  var itemCk = cleanKey(product.item);
  var id = String(product._id || product.id || '').trim();
  var sum = 0;
  itemsList.forEach(function(item) {
    var iNameCk = cleanKey(item.productName);
    var iId = String(item.productId || '').trim();
    
    var isMatch = false;
    if (id && iId && id === iId) isMatch = true;
    else if (nameCk && iNameCk && nameCk === iNameCk) isMatch = true;
    else if (itemCk && iNameCk && itemCk === iNameCk) isMatch = true;
    else if (nameCk && iNameCk && (nameCk.endsWith(iNameCk) || iNameCk.endsWith(nameCk))) isMatch = true;
    
    if (isMatch) {
      sum += Number(item.totalQty || 0);
    }
  });
  return sum;
}
function getPrice(p,ref){if(!p||!ref)return null;var v=p.prices[ref];return v!=null?Number(v):null;}
function stockClass(n){return n>=50?'stk-ok':n>0?'stk-low':'stk-out';}
function stockLabel(n){return n>=50?fmtNum(n)+' in stock':n>0?fmtNum(n)+' low!':n<0?fmtNum(n)+' oversold!':'No stock';}
function todayDisp(){var d=new Date();return pad(d.getDate())+'-'+pad(d.getMonth()+1)+'-'+d.getFullYear();}
function fmtDateDMY(dateStr){
  if(!dateStr)return '';
  var d=new Date(dateStr);
  if(isNaN(d.getTime()))return dateStr;
  return pad(d.getDate())+'-'+pad(d.getMonth()+1)+'-'+d.getFullYear();
}
function todayCode(){var d=new Date();return pad(d.getDate())+pad(d.getMonth()+1)+String(d.getFullYear()).slice(2);}
function pad(n){return String(n).padStart(2,'0');}
function saveAll(){
  lsSet('lang',lang);
  lsSet('products',products);
  lsSet('customers',customers);
  lsSet('bills',bills);
}

// == TRANSLATIONS ==
var T={
  en:{welcome:'Welcome back',home:'Home',dashboard:'Dashboard',billing:'New Estimate',inventory:'Inventory',priceLookupNav:'Price Lookup',customersNav:'Customers',pendingLoadsNav:'Pending Loads',history:'Estimate History',settings:'Settings',
    totalProds:'Products',totalStock:'Stock',lowStock:'Low Stock',todayBills:"Today's Estimates",todayRev:"Today's Revenue",
    newBill:'Create New Estimate',customer:'Customer',refNum:'Reference No.',
    searchProd:'Type product name or company...',
    addItem:'Add to Estimate',cases:'No. of Cases',loose:'Loose Qty',
    price:'Price',stock:'Stock',grandTotal:'GRAND TOTAL',saveBill:'Save & Print Estimate',
    delete:'Delete',print:'Print',pdf:'Download PDF',addProd:'Add Product',editProd:'Edit Product',
    noItems:'No items yet. Search and add products above.',
    selectCust:'Select or type customer name...',selectRef:'Select Reference Number...',
    billSaved:'Estimate saved!',stockUpdated:'Stock updated!',save:'Save',cancel:'Cancel',
    filterAll:'All',filterLow:'Low Stock',filterOut:'No Stock',filterNeg:'Negative Stock',filterIn:'In Stock',
    step1:'Step 1: Customer & Reference',step2:'Step 2: Search & Add Products',step3:'Step 3: Review & Save'},
  te:{welcome:'తిరిగి స్వాగతం',home:'హోమ్',dashboard:'డ్యాష్‌బోర్డ్',billing:'కొత్త ఎస్టిమేట్',inventory:'స్టాక్',priceLookupNav:'ధర శోధన',customersNav:'కస్టమర్లు',pendingLoadsNav:'పెండింగ్ లోడ్స్',history:'ఎస్టిమేట్ చరిత్ర',settings:'సెట్టింగ్స్',
    totalProds:'వస్తువులు',totalStock:'స్టాక్',lowStock:'తక్కువ స్టాక్',todayBills:'ఈరోజు ఎస్టిమేట్లు',todayRev:'ఈరోజు ఆదాయం',
    newBill:'కొత్త ఎస్టిమేట్ చేయి',customer:'కస్టమర్',refNum:'రెఫరెన్స్ నం.',
    searchProd:'వస్తువు పేరు టైప్ చేయండి...',
    addItem:'జోడించు',cases:'పెట్టెల సంఖ్య',loose:'వదులు పరిమాణం',
    price:'ధర',stock:'స్టాక్',grandTotal:'మొత్తం',saveBill:'సేవ్ & ప్రింట్',
    delete:'తొలగించు',print:'ప్రింట్',pdf:'PDF',addProd:'వస్తువు జోడించు',editProd:'వస్తువు సవరించు',
    noItems:'వస్తువులు జోడించలేదు.',
    selectCust:'కస్టమర్ ఎంచుకోండి...',selectRef:'రెఫరెన్స్ నంబర్ ఎంచుకోండి...',
    billSaved:'ఎస్టిమేట్ సేవ్ అయింది!',stockUpdated:'స్టాక్ అప్‌డేట్!',save:'సేవ్',cancel:'రద్దు',
    filterAll:'అన్నీ',filterLow:'తక్కువ స్టాక్',filterOut:'స్టాక్ లేదు',filterNeg:'నెగటివ్ స్టాక్',filterIn:'స్టాక్ ఉంది',
    step1:'దశ 1: కస్టమర్ & రెఫరెన్స్',step2:'దశ 2: వస్తువు వెతకండి',step3:'దశ 3: సమీక్ష & సేవ్'}
};
function t(k){return (T[lang]||T.en)[k]||k;}

// == TOAST ==
function toast(msg,type){
  type=type||'ok';
  var d=document.createElement('div');
  d.className='toast-msg toast-'+type;
  d.innerHTML=(type==='ok'?'&#9989;':'&#10060;')+' '+esc(msg);
  document.getElementById('toast').appendChild(d);
  setTimeout(function(){d.remove();},3500);
}

// == MODAL ==
function showModal(html,cb){
  var mc=document.getElementById('modal-container');
  mc.style.display='block'; // Show container
  mc.innerHTML='<div class="ov" id="modal-ov">'+html+'</div>';
  var ov=document.getElementById('modal-ov');
  ov.addEventListener('click',function(e){if(e.target===ov)closeModal();});
  if(cb)cb();
}
function closeModal(){
  var mc = document.getElementById('modal-container');
  mc.innerHTML='';
  mc.style.display='none'; // Hide so it doesn't block clicks
  // If on history tab, refresh list to show any updates
  if (curTab === 'history' && typeof renderHistoryList === 'function') {
    renderHistoryList();
  }
}

// == LANG ==
function setLang(l){
  lang=l;lsSet('lang',l);
  document.getElementById('btn-en').classList.toggle('on',l==='en');
  document.getElementById('btn-te').classList.toggle('on',l==='te');
  initNav();renderPage(curTab);
}

// == NAV ==
var NAV_TABS=[
  {id:'dashboard',icon:'&#128202;',key:'dashboard'},
  {id:'billing',icon:'&#129534;',key:'billing'},
  {id:'inventory',icon:'&#128230;',key:'inventory'},
  {id:'pricelookup',icon:'&#128269;',key:'priceLookupNav'},
  {id:'customers',icon:'&#128101;',key:'customersNav'},
  {id:'pendingloads',icon:'&#9203;',key:'pendingLoadsNav'},
  {id:'history',icon:'&#128203;',key:'history'},
  {id:'settings',icon:'&#9881;',key:'settings'}
];
function initNav(){
  // Top scrolling tab bar has been replaced by the Home tile grid
  // (see renderHome). Kept as a no-op so existing calls stay harmless.
}

// == HOME (TILE MENU) ==
function renderHome(){
  var el=document.getElementById('pg-home');
  if(!el) return;
  var visibleTabs = NAV_TABS;
  if(userRole === 'employee') {
    visibleTabs = NAV_TABS.filter(function(tb){return tb.id !== 'settings';});
  }
  var tilesHtml = visibleTabs.map(function(tb){
    return '<div class="home-tile" onclick="goTab(\''+tb.id+'\')">'+
      '<div class="home-tile-icon">'+tb.icon+'</div>'+
      '<div class="home-tile-label">'+t(tb.key)+'</div>'+
    '</div>';
  }).join('');
  el.innerHTML =
    '<div class="home-hero">'+
      '<div class="home-hero-eyebrow">GLT Fireworks &middot; Gollagunta</div>'+
      '<div class="home-hero-title">'+t('welcome')+'</div>'+
      '<div class="home-hero-sub">'+todayDisp()+' &middot; <span title="App version">v'+APP_VERSION+'</span></div>'+
    '</div>'+
    '<div class="home-grid">'+tilesHtml+'</div>';
}
// Called when navigating away from the Billing tab. If there's an
// in-progress bill with a customer and reference set, it gets saved and
// closed automatically (same as clicking Save) — so returning to Billing
// always starts fresh. An edit-in-progress is finalized the same way; to
// keep editing after that, the user just reopens it via "Edit Estimate".
// If items were added but customer/reference were never chosen (so there's
// no valid bill to save), the incomplete draft is discarded rather than
// left hanging.
function autoCloseBillingDraft(){
  if(!billItems.length){
    // No items — just exit cleanly
    if(window._editingOriginalId) cancelEdit();
    return;
  }
  // If complete — save and exit
  if(billCustomer.trim() && billRef){
    saveBill(true);
  }
  // If incomplete — just leave, keep everything in memory
  // billItems, billCustomer, billRef stay intact
  // When user comes back to billing tab, they continue where they left off
  // (renderBilling re-reads the globals — nothing is lost)
}

// Switch tab without triggering a background cloud refresh (used after bill save)
function goTabNoSync(id) {
  curTab = id;
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.getElementById('pg-'+id).classList.add('active');
  renderPage(id); // Always renders from latest local bills array
}

// Direct home navigation - bypasses all guards
// Works from anywhere including billing/edit mode
function exitToHome(){
  try {
    // Close any open modal first
    var mc = document.getElementById('modal-container');
    if(mc){ mc.innerHTML=''; mc.style.display='none'; }

    // Auto-save bill if complete
    if(billItems && billItems.length > 0 && billCustomer && billCustomer.trim() && billRef){
      saveBill(true);
    }

    // Force navigate to home directly
    curTab = 'home';
    document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
    var pg = document.getElementById('pg-home');
    if(pg){
      pg.classList.add('active');
      // Scroll to top
      document.getElementById('pages').scrollTop = 0;
    }
    renderPage('home');
    // Clear any edit state
    window._editingOriginalId = null;
    window._editingOriginalBill = null;
  } catch(e) {
    // Force navigate even if error
    console.error('exitToHome error:', e);
    window.location.reload();
  }
}

function goTab(id){
  if(userRole === 'employee' && id === 'settings') {
    toast('Access denied. Settings is Admin-only.','err');
    return;
  }

  // Leaving billing tab or edit mode — auto-save if complete
  var leavingBilling = (id !== 'billing') && (curTab === 'billing' || window._editingOriginalId);
  if(leavingBilling){
    var saved = false;
    if(billItems.length && billCustomer.trim() && billRef){
      saved = saveBill(true); // auto-save complete bill
    }
    // Whether saved or not — always navigate away
    // incomplete bills stay in memory for later
  }

  // Navigate
  curTab = id;
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  var pg = document.getElementById('pg-'+id);
  if(pg) pg.classList.add('active');
  renderPage(id);
}

// Merges estimates coming from the cloud into this device's list.
// Estimates are matched by their unique _id - NOT by estimate number, because two devices
// can print the same number and both estimates must be kept.
//   * an estimate this device does not have yet is added
//   * one it has is replaced only when the cloud copy is newer AND this device is not in the middle
//     of editing it / still waiting to upload its own changes to it
function mergeCloudBills(remote) {
  if (!remote || !remote.length) return false;
  var pending = (typeof GLTCloud !== 'undefined' && GLTCloud.pendingBillIds) ? GLTCloud.pendingBillIds() : {};
  var busy = {};
  if (window._activeDraftBillId) busy[String(window._activeDraftBillId)] = 1;
  if (window._editingOriginalId) busy[String(window._editingOriginalId)] = 1;
  var byKey = {}, order = [];
  bills.forEach(function(b) {
    var k = String(b._id || b.billNumber || '');
    if (!k) return;
    if (!byKey[k]) order.push(k);
    byKey[k] = b;
  });
  var changed = false;
  remote.forEach(function(rb) {
    var k = String(rb._id || rb.billNumber || '');
    if (!k) return;
    var lb = byKey[k];
    if (!lb) { byKey[k] = rb; order.push(k); changed = true; return; }
    if (busy[k] || pending[k]) return;
    var rt = new Date(rb.updatedAt || rb.date || 0).getTime();
    var lt = new Date(lb.updatedAt || lb.date || 0).getTime();
    if (rt > lt) { byKey[k] = rb; changed = true; }
  });
  if (changed) {
    bills = order.map(function(k) { return byKey[k]; });
    saveAll();
  }
  return changed;
}

function mergeServerData(d, includeBills) {
  if (!d) return;
  if (d.products && d.products.length > 0) {
    // The cloud database is the master for product names and prices.
    // Match by row position (_id) first — this handles renamed products correctly.
    // Old bills keep their own productName snapshot — unaffected.

    var byId = {};   // _id  → local product
    var byName = {}; // lowercase name → local product (fallback)
    products.forEach(function(p) {
      if (p._id != null) byId[String(p._id)] = p;
      var k = (p.name || '').toLowerCase().trim();
      if (k) byName[k] = p;
    });

    // Rebuild products list from server order (the cloud database is the master order)
    var merged = d.products.map(function(rp) {
      var sid = String(rp._id || '');
      var sk  = (rp.name || '').toLowerCase().trim();

      // Find local match: by _id first, then by name
      var lp = byId[sid] || byName[sk] || null;

      if (!lp) {
        // Brand new product added elsewhere — add to app
        return rp;
      }

      // Merge: the cloud wins for name, category, uom, qtyPerCase, costPrice, prices
      // App wins for stock levels (stockCases/stockLoose/stock) unless the cloud has newer data
      return Object.assign({}, lp, {
        name:       rp.name       || lp.name,        // ← cloud name wins (spelling fixes)
        company:    rp.company    || lp.company,
        category:   rp.category   || lp.category,
        uom:        rp.uom        || lp.uom,
        qtyPerCase: rp.qtyPerCase != null ? rp.qtyPerCase : lp.qtyPerCase,
        costPrice:  rp.costPrice  != null ? rp.costPrice  : lp.costPrice,
        // Stock: the cloud value is used
        // (app may have live deductions not yet uploaded)
        stockCases: rp.stockCases != null ? rp.stockCases : lp.stockCases,
        stockLoose: rp.stockLoose != null ? rp.stockLoose : lp.stockLoose,
        stock:      rp.stock      != null ? rp.stock      : lp.stock,
        prices:     Object.assign({}, lp.prices || {}, rp.prices || {})
      });
    });

    // Recalculate stock using formula after merge
    merged.forEach(function(p) {
      var qpc = p.qtyPerCase || 0;
      if (qpc > 0) {
        p.stock = (p.stockCases || 0) * qpc + (p.stockLoose || 0);
      }
    });

    products = merged;
    saveAll(); // persist updated names immediately
  }

  // Save settings from the cloud (price_edit_password etc. - sent to admins only)
  if (d.settings && Object.keys(d.settings).length > 0) {
    appSettings = Object.assign({}, appSettings, d.settings);
    lsSet('appSettings', appSettings);
  }

  // Estimates made on other devices (see mergeCloudBills for the rules)
  if (includeBills && d.bills && d.bills.length > 0) {
    mergeCloudBills(d.bills);
  }

  if (d.customers && d.customers.length > 0) {
    var custMap = {};
    customers.forEach(function(c) {
      var ck = (c.contact || c.name || c._id).toString().toLowerCase().trim();
      if (ck) custMap[ck] = c;
    });
    d.customers.forEach(function(rc) {
      var ck = (rc.contact || rc.name || rc._id).toString().toLowerCase().trim();
      if (!ck) return;
      custMap[ck] = rc; // server is the source of truth once synced
    });
    customers = Object.keys(custMap).map(function(k) { return custMap[k]; });
  }

  if (d.references && d.references.length > 0) {
    var changed = false;
    d.references.forEach(function(r) {
      if (r.id && r.name && REF_MAP[String(r.id)] !== r.name) {
        REF_MAP[String(r.id)] = r.name;
        changed = true;
      }
    });
    if (changed) {
      rebuildRefList();
      lsSet('refMap', REF_MAP);
    }
  }

  saveAll();
  if (typeof curTab !== 'undefined' && typeof renderPage === 'function') {
    renderPage(curTab);
  }
}

// == LOGIN ==
// Login uses Supabase Authentication (username + password) and there are two roles:
//   admin    - everything
//   employee - estimates, customers, price lookup, pending loads, history (no Settings, no product editing)
function enterApp(profile) {
  userRole = profile.role === 'admin' ? 'admin' : 'employee';
  curUser = { username: profile.username, role: userRole };
  lsSet('currentUser', profile.username);
  lsSet('userRole', userRole);
  lsSet('auth', true);
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('user-role-badge').innerText = userRole.toUpperCase();
  document.getElementById('user-profile-nav').className = 'user-badge ' + (userRole === 'admin' ? 'tag-pu' : 'tag-b');
  curTab = 'home';
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.getElementById('pg-home').classList.add('active');
  renderPage('home');                    // instant, from local data
  GLTCloud.paintBadge();
  // background: upload anything that was waiting, then refresh from the cloud
  setTimeout(function() {
    GLTCloud.flush().then(function() {
      gdPullFromScriptSilently(function() { renderPage(curTab === 'home' ? 'home' : curTab); });
    });
  }, 800);
}

function showLogin(message) {
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
  var errEl = document.getElementById('login-err');
  if (errEl) errEl.innerHTML = message ? '<div class="alert alert-err">&#10060; ' + esc(message) + '</div>' : '';
}

function logoutNow(message) {
  try { apiReleaseAll(); } catch (e) {}
  GLTCloud.signOut();
  lsSet('auth', false);
  showLogin(message);
}

function initLogin(){
  var btn=document.getElementById('btn-login');
  var uInp=document.getElementById('inp-user');
  var pInp=document.getElementById('inp-pass');
  var errEl=document.getElementById('login-err');

  function doLogin(){
    var u=(uInp.value||'').trim(), p=(pInp.value||'');
    if(!u||!p){
      errEl.innerHTML='<div class="alert alert-err">&#10060; Enter your username and password.</div>';
      return;
    }
    var label=btn.innerHTML;
    btn.disabled=true; btn.innerHTML='&#8987; Logging in...'; errEl.innerHTML='';
    GLTCloud.signIn(u,p).then(function(profile){
      pInp.value='';
      enterApp(profile);
      toast('Logged in as ' + profile.username);
    }, function(err){
      errEl.innerHTML='<div class="alert alert-err">&#10060; '+esc(err.message)+'</div>';
    }).then(function(){ btn.disabled=false; btn.innerHTML=label; });
  }

  if (btn) btn.onclick = doLogin;
  if (pInp) pInp.onkeydown = function(e){ if (e.key === 'Enter') doLogin(); };
  if (uInp) uInp.onkeydown = function(e){ if (e.key === 'Enter') pInp.focus(); };

  document.documentElement.setAttribute('data-theme', 'dark');

  var logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) logoutBtn.onclick = function() { logoutNow(''); };

  // Already logged in on this device? Open straight away (works with no internet),
  // then confirm the login with the cloud in the background.
  var quick = GLTCloud.quickRestore();
  if (quick) {
    enterApp(quick);
    if (!GLTCloud.ready()) {
      // The Supabase library could not be loaded (no internet and nothing cached): work from this device only
      setTimeout(function() { toast('No internet - working from this device only. Reload once the internet is back to sync.', 'err'); }, 1200);
      return;
    }
    GLTCloud.restore().then(function(p) {
      if (!p) logoutNow('Your session has ended. Please log in again.');
      else if (p.role !== userRole) enterApp(p);      // role changed by the admin
    }, function(err) {
      if (!GLTCloud.isNetworkError(err)) logoutNow(err.message);
    });
    return;
  }

  if (!GLTCloud.configured() || GLTCloud.configHelp()) {
    errEl.innerHTML = '<div class="alert alert-warn">&#9888;&#65039; ' + esc(GLTCloud.configHelp()) + '</div>';
  }
}

// == RENDER ROUTER ==
function renderPage(id){
  if(id==='home')renderHome();
  else if(id==='dashboard')renderDashboard();
  else if(id==='billing')renderBilling();
  else if(id==='inventory')renderInventory();
  else if(id==='pricelookup')renderPriceLookup();
  else if(id==='customers')renderCustomersPage();
  else if(id==='pendingloads')renderPendingLoads();
  else if(id==='history')renderHistory();
  else if(id==='settings')renderSettings();
}

// == DASHBOARD ==
function renderDashboard(){
  var el=document.getElementById('pg-dashboard');
  var totalStock=products.reduce(function(s,p){return s+(p.stock||0);},0);
  var lowItems=products.filter(function(p){return (p.stock||0)>0&&(p.stock||0)<50;});
  var outItems=products.filter(function(p){return !(p.stock||0);});
  var negItems=products.filter(function(p){return (p.stock||0)<0;}).sort(function(a,b){return (a.stock||0)-(b.stock||0);});
  var todayStr=new Date().toDateString();
  var todayBills=bills.filter(function(b){return new Date(b.date).toDateString()===todayStr;});
  var todayRev=todayBills.reduce(function(s,b){return s+(b.totalAmount||0);},0);
  
  var itemSales = {};
  bills.forEach(function(b) {
    if (b.items) {
      b.items.forEach(function(it) {
        itemSales[it.productName] = (itemSales[it.productName] || 0) + it.totalQty;
      });
    }
  });
  var topItems = Object.entries(itemSales)
    .sort(function(a,b){return b[1] - a[1];})
    .slice(0, 5);
    
  var topItemsHtml = topItems.map(function(item, idx) {
    var colors = ['var(--red-text)', 'var(--orange-text)', '#fbbf24', 'var(--green-text)', 'var(--blue-text)'];
    var col = colors[idx] || 'var(--text-muted)';
    return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--card-border);font-size:14px">'+
      '<div><span style="color:'+col+';font-weight:800;margin-right:8px">#'+(idx+1)+'</span>'+esc(item[0])+'</div>'+
      '<div style="font-weight:700;color:var(--text-main)">'+fmtNum(item[1])+' units</div>'+
    '</div>';
  }).join('');
  if (!topItems.length) topItemsHtml = '<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:14px">No sales data yet</div>';

  var custSales = {};
  bills.forEach(function(b) {
    custSales[b.customerName] = (custSales[b.customerName] || 0) + b.totalAmount;
  });
  var topCust = Object.entries(custSales)
    .sort(function(a,b){return b[1] - a[1];})[0];
  var topCustHtml = topCust ? 
    '<div style="text-align:center;padding:15px;background:var(--btn-sec-bg);border:1px solid var(--card-border);border-radius:12px;margin-top:8px">'+
      '<div style="font-size:30px;margin-bottom:6px">&#129351;</div>'+
      '<div style="font-weight:800;font-size:18px;color:var(--text-main)">'+esc(topCust[0])+'</div>'+
      '<div style="font-size:15px;color:var(--text-muted);margin-top:4px">Total Spent: <strong style="color:var(--brand)">'+fmtMoney(topCust[1])+'</strong></div>'+
    '</div>' : 
    '<div style="text-align:center;padding:15px;color:var(--text-muted);font-size:14px">No customer sales data</div>';

  var negHtml = '';
  if (negItems.length > 0) {
    var negTags = negItems.slice(0, 10).map(function(p) {
      return '<span class="tag tag-r" style="background:rgba(127,29,29,0.35);color:#fecaca;border:1px solid #7f1d1d;padding:4px 8px;font-weight:700">'+esc(p.name.slice(0,30))+' ('+fmtNum(p.stock)+')</span>';
    }).join(' ');
    negHtml = '<div class="card" style="border:2px solid #7f1d1d;background:rgba(127,29,29,0.06)">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">'+
        '<div class="card-title" style="color:var(--red-text);margin-bottom:0">&#128683; Oversold — Negative Stock ('+negItems.length+' items)</div>'+
        '<button class="btn btn-del btn-sm" onclick="showNegativeStockModal()">&#128203; View Full List</button>'+
      '</div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">'+negTags+(negItems.length>10?' <span class="tag tag-gy">+'+(negItems.length-10)+' more</span>':'')+'</div>'+
    '</div>';
  }

  var critAlertHtml = '';
  if (outItems.length > 0) {
    var critTags = outItems.slice(0, 10).map(function(p) {
      return '<span class="tag tag-r" style="background:rgba(239,68,68,0.14);color:var(--red-text);border:1px solid rgba(239,68,68,0.35);padding:4px 8px;font-weight:700">'+esc(p.name.slice(0,30))+'</span>';
    }).join(' ');
    critAlertHtml = '<div class="card" style="border:2px solid var(--danger);background:rgba(220, 38, 38, 0.02)">'+
      '<div class="card-title" style="color:var(--danger)">&#10060; Critical Alert: Out Of Stock ('+outItems.length+' items)</div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">'+critTags+'</div>'+
    '</div>';
  }

  var lowHtml = '';
  if (lowItems.length) {
    var tags = lowItems.slice(0, 15).map(function(p) {
      return '<span class="tag tag-o" style="padding:4px 8px">'+esc(p.name.slice(0,28))+' (' + p.stock + ')</span>';
    }).join(' ');
    lowHtml = '<div class="card" style="border-left:4px solid var(--warning)"><div class="card-title" style="color:var(--warning)">&#9888;&#65039; Low Stock Alert ('+lowItems.length+' items)</div><div style="display:flex;flex-wrap:wrap;gap:6px">'+tags+'</div></div>';
  }

  var recent = bills.slice(0, 5);
  var recentHtml = '';
  if (recent.length) {
    var rows = recent.map(function(b) {
      return '<tr><td><span class="tag tag-r">#'+esc(b.billNumber)+'</span></td><td style="font-weight:700;font-size:14px">'+esc(b.customerName)+'</td><td style="color:var(--text-muted);font-size:13.5px">'+esc(b.displayDate||'')+'</td><td class="num" style="font-weight:700">'+fmtMoney(b.totalAmount)+'</td></tr>';
    }).join('');
    recentHtml = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Estimate #</th><th>Customer</th><th>Date</th><th style="text-align:right">Amount</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  } else {
    recentHtml = '<div class="empty"><div class="empty-ico">&#128203;</div><div class="empty-txt">No estimates yet. Create your first estimate!</div></div>';
  }

  var isAdmin = userRole === 'admin';

  el.innerHTML=
    '<div style="margin-bottom:18px"><h2 class="sec-title" style="margin-bottom:4px">&#128202; '+t('dashboard')+'</h2><p style="color:var(--text-muted);font-size:14px">'+todayDisp()+' &middot; GLT Fireworks, Gollagunta</p></div>'+
    '<div class="stats">'+
      '<div class="stat" style="border-top:3px solid var(--brand)"><div class="n" style="color:var(--brand)">'+products.length+'</div><div class="l">'+t('totalProds')+'</div></div>'+
      '<div class="stat" style="border-top:3px solid var(--info)"><div class="n" style="color:var(--info)">'+fmtNum(totalStock)+'</div><div class="l">'+t('totalStock')+'</div></div>'+
      '<div class="stat" style="border-top:3px solid #7f1d1d"><div class="n" style="color:var(--red-text)">'+negItems.length+'</div><div class="l">Negative Stock</div></div>'+
      '<div class="stat" style="border-top:3px solid var(--warning)"><div class="n" style="color:var(--warning)">'+lowItems.length+'</div><div class="l">'+t('lowStock')+'</div></div>'+
      '<div class="stat" style="border-top:3px solid var(--danger)"><div class="n" style="color:var(--danger)">'+outItems.length+'</div><div class="l">Out of Stock</div></div>'+
      '<div class="stat" style="border-top:3px solid var(--success)"><div class="n" style="color:var(--success)">'+todayBills.length+'</div><div class="l">'+t('todayBills')+'</div></div>'+
      (isAdmin?'<div class="stat" style="border-top:3px solid var(--purple)"><div class="n" style="color:var(--purple)">'+fmtMoney(todayRev)+'</div><div class="l">'+t('todayRev')+'</div></div>':'')+
    '</div>'+
    
    '<div class="grid2" style="margin-bottom:14px">'+
      '<button class="btn btn-r btn-lg" style="justify-content:center;width:100%;font-weight:700" onclick="goTab(\'billing\')">&#129534; '+t('newBill')+'</button>'+
      '<button class="btn btn-b btn-lg" style="justify-content:center;width:100%;font-weight:700" onclick="goTab(\'inventory\')">&#128230; '+t('inventory')+'</button>'+
    '</div>'+
    
    negHtml +
    critAlertHtml +
    lowHtml +
    
    (isAdmin?'<div class="grid2" style="margin-bottom:14px;grid-template-columns: 2fr 1fr;gap:14px;align-items:stretch">'+
      '<div class="card" style="margin-bottom:0;display:flex;flex-direction:column">'+
        '<div class="card-title">&#128200; Monthly Revenue Analysis</div>'+
        '<div style="flex:1;position:relative;min-height:220px">'+
          '<canvas id="chart-monthly-rev"></canvas>'+
        '</div>'+
      '</div>'+
      '<div class="card" style="margin-bottom:0">'+
        '<div class="card-title">&#129351; Top Customer</div>'+
        topCustHtml +
      '</div>'+
    '</div>':'')+

    '<div class="grid2" style="margin-bottom:14px;grid-template-columns: 1fr 1fr;gap:14px">'+
      '<div class="card" style="margin-bottom:0">'+
        '<div class="card-title">&#128201; Top Performing Items</div>'+
        '<div style="display:flex;flex-direction:column;gap:4px">'+topItemsHtml+'</div>'+
      '</div>'+
      '<div class="card" style="margin-bottom:0">'+
        '<div class="card-title">&#129534; Recent Estimates</div>'+
        recentHtml +
      '</div>'+
    '</div>';

  setTimeout(initDashboardChart, 50);
}

function showNegativeStockModal(){
  var negItems=products.filter(function(p){return (p.stock||0)<0;}).sort(function(a,b){return (a.stock||0)-(b.stock||0);});
  var rows = negItems.map(function(p){
    return '<tr>'+
      '<td style="font-weight:700;font-size:14px">'+esc(p.name)+'</td>'+
      '<td class="num" style="font-weight:800;color:var(--red-text)">'+fmtNum(p.stock)+'</td>'+
      '<td class="num" style="font-weight:700;color:var(--red-text)">'+fmtNum(Math.abs(p.stock))+' '+esc(p.uom||'')+'</td>'+
    '</tr>';
  }).join('');
  var body = negItems.length
    ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Product</th><th style="text-align:right">Current Stock</th><th style="text-align:right">Need to Purchase</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
    : '<div class="empty"><div class="empty-ico">&#9989;</div><div class="empty-txt">No oversold items right now.</div></div>';

  showModal('<div class="modal" style="max-width:640px">'+
    '<div class="modal-hdr"><span class="modal-title">&#128683; Oversold Items — Need to Purchase ('+negItems.length+')</span><button class="modal-x" onclick="closeModal()">&#10005;</button></div>'+
    '<div class="modal-body">'+body+'</div>'+
    '<div class="modal-ftr"><button class="btn btn-gh" onclick="closeModal()">Close</button></div>'+
  '</div>');
}

function initDashboardChart() {
  var ctx = document.getElementById('chart-monthly-rev');
  if (!ctx) return;
  
  var months = [];
  var revenue = [];
  var monthMap = {};
  
  for (var i = 5; i >= 0; i--) {
    var d = new Date();
    d.setMonth(d.getMonth() - i);
    var label = d.toLocaleString('default', { month: 'short' }) + ' ' + d.getFullYear();
    months.push(label);
    monthMap[d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')] = 0;
  }
  
  bills.forEach(function(b) {
    var bd = new Date(b.date);
    var key = bd.getFullYear() + '-' + String(bd.getMonth() + 1).padStart(2, '0');
    if (monthMap[key] !== undefined) {
      monthMap[key] += (b.totalAmount || 0);
    }
  });
  
  months.forEach(function(label, idx) {
    var d = new Date();
    d.setMonth(d.getMonth() - (5 - idx));
    var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    revenue.push(monthMap[key] || 0);
  });

  if (window._myDashboardChart) {
    window._myDashboardChart.destroy();
  }

  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var textColor = isDark ? '#a3a9b8' : '#4b5563';
  var gridColor = isDark ? 'rgba(255,255,255,0.07)' : '#e5e7eb';

  window._myDashboardChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [{
        label: 'Revenue (₹)',
        data: revenue,
        backgroundColor: 'rgba(233, 185, 92, 0.78)',
        borderColor: '#e9b95c',
        borderWidth: 2,
        borderRadius: 6,
        hoverBackgroundColor: '#f7dc9c'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: isDark ? '#171a25' : '#ffffff',
          titleColor: isDark ? '#ffffff' : '#111827',
          bodyColor: isDark ? '#d1d5db' : '#374151',
          borderColor: '#e9b95c',
          borderWidth: 1,
          padding: 14,
          titleFont: { family: 'Inter, sans-serif', size: 14 },
          bodyFont: { family: 'Inter, sans-serif', size: 14 },
          displayColors: false
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: textColor,
            font: {
              family: 'Inter, sans-serif',
              size: 13
            }
          }
        },
        y: {
          grid: {
            color: gridColor
          },
          ticks: {
            color: textColor,
            font: {
              family: 'Inter, sans-serif',
              size: 13
            },
            callback: function(value) {
              return '₹' + value;
            }
          }
        }
      }
    }
  });
}

function getBillNum(){
  if (window._editingOriginalBill && window._editingOriginalBill.billNumber) {
    return window._editingOriginalBill.billNumber;
  }
  var u = (typeof curUser !== 'undefined' && curUser && curUser.username) ? curUser.username.slice(0, 3).toUpperCase() : 'USR';
  var code = todayCode();
  // next number = highest number used today (by anyone, on any device we know of) + 1.
  // The estimate being drafted right now is left out, so its own number stays stable.
  var draftId = window._activeDraftBillId ? String(window._activeDraftBillId) : '';
  var highest = 0;
  bills.forEach(function(b) {
    if (!b.billNumber) return;
    if (draftId && String(b._id) === draftId) return;
    var m = /^(\d{6})_[^_]+_(\d+)$/.exec(String(b.billNumber));
    if (m && m[1] === code) highest = Math.max(highest, parseInt(m[2], 10));
  });
  return code + '_' + u + '_' + String(highest + 1).padStart(3, '0');
}

function promptEditItemPrice(i) {
  var item = billItems[i];
  if (!item) return;

  var pwd = prompt("🔐 Admin Password Required\n\nEnter password to edit price for Ref #" + (billRef || '1') + ":");
  if (pwd === null) return;

  var cleanPwd = String(pwd).trim();
  // The password is checked by the cloud database (employees can't read it, only test a guess)
  checkPricePassword(cleanPwd, function(ok, errMsg) {
    if (errMsg) { toast(errMsg, 'err'); return; }
    if (!ok) { toast('Incorrect password! Access denied.', 'err'); return; }
    continueEditItemPrice(i);
  });
}

function continueEditItemPrice(i) {
  var item = billItems[i];
  if (!item) return;

  var newPriceStr = prompt("✏️ Edit Price for Ref #" + (billRef || '1') + "\n\nProduct: " + item.productName + "\nCurrent Price: ₹" + item.sellingPrice + "\n\nEnter new price:", item.sellingPrice);
  if (newPriceStr === null) return;

  var newPrice = parseFloat(newPriceStr);
  if (isNaN(newPrice) || newPrice < 0) {
    toast('Invalid price entered!', 'err');
    return;
  }

  billItems[i].sellingPrice = newPrice;
  billItems[i].totalAmount = (billItems[i].totalQty || 0) * newPrice;

  var targetRef = billRef || '1';
  var refName = REF_MAP[targetRef] || ('Ref #' + targetRef);

  // Ask user if price should be saved to master price list
  var updateMaster = confirm('Update master price list?\n\nProduct: ' + item.productName + '\nNew Price: Rs.' + newPrice + '\nReference: ' + refName + '\n\nOK = Save to price list & upload to the cloud\nCancel = Apply to this bill only');

  // 1. Find product in products catalog using 4-way matching rule
  var pIdx = products.findIndex(function(p) {
    var pId = String(p._id || p.id || '').trim();
    var iId = String(item.productId || '').trim();
    var pName = cleanKey(p.name);
    var iName = cleanKey(item.productName);
    return (pId && iId && pId === iId) ||
           (pName && iName && pName === iName) ||
           (pName && iName && (pName.endsWith(iName) || iName.endsWith(pName)));
  });

  if (updateMaster && pIdx >= 0) {
    var prod = products[pIdx];
    if (!prod.prices) prod.prices = {};
    prod.prices[targetRef] = newPrice;

    // Link productId if missing
    item.productId = prod._id || prod.id || item.productId;

    // 2. Update in ALL_PRODUCTS array if present
    if (typeof ALL_PRODUCTS !== 'undefined' && Array.isArray(ALL_PRODUCTS)) {
      var apIdx = ALL_PRODUCTS.findIndex(function(x) {
        var xId = String(x._id || x.id || '').trim();
        var xName = cleanKey(x.name);
        return (xId && prod._id && xId === String(prod._id)) || (xName && cleanKey(prod.name) && xName === cleanKey(prod.name));
      });
      if (apIdx >= 0) {
        if (!ALL_PRODUCTS[apIdx].prices) ALL_PRODUCTS[apIdx].prices = {};
        ALL_PRODUCTS[apIdx].prices[targetRef] = newPrice;
      }
    }
  }

  saveAll();
  onBillItemsChanged();
  renderBilling();

  if (updateMaster) {
    saveAll();
    toast('&#9989; Price &#8377;' + newPrice + ' saved to ' + refName + ' & synced to the cloud!', 'ok');
    if (cloudOn()) {
      apiCall('updateProductPrice', {
        productId: item.productId || (pIdx >= 0 ? products[pIdx]._id : ''),
        productName: item.productName,
        refId: targetRef,
        price: newPrice
      }, function(res) {
        if (res.status !== 'success') toast('Cloud sync failed: ' + (res.message||''), 'err');
      });
    }
  } else {
    toast('&#9989; Price &#8377;' + newPrice + ' applied to this bill only.', 'ok');
  }
}

function buildBillItemsTableOnly(){
  var total      = billItems.reduce(function(s,i){return s+(i.totalAmount||0);},0);
  var totalCases = billItems.reduce(function(s,i){return s+(i.cases||0);},0);
  var q = (billItemSearch||'').trim().toLowerCase();
  var visibleIdx = billItems.map(function(item,i){return i;}).filter(function(i){
    return !q || billItems[i].productName.toLowerCase().indexOf(q)>=0;
  });

  // Common cell style with vertical border
  var tdBorder = 'border-right:1px solid var(--card-border);';
  var inp      = 'padding:8px 4px;border-radius:8px;font-size:14px;font-weight:700;color:var(--text-main);background:var(--input-bg);text-align:center;';
  var inpBdr   = 'border:1px solid var(--input-border);';
  var inpRed   = 'border:2px solid var(--red-text);';

  var rows = visibleIdx.map(function(i){
    var item    = billItems[i];
    var loaded  = item.qtyLoaded  != null ? item.qtyLoaded  : 0;
    var pendInfo = pendingDiffInfo(item);   // Loaded - Order Qty, signed and coloured
    var qpc     = item.qtyPerCase || 0;

    // Cases input — always shows cases (never cleared)
    var casesInp = '<input type="number" data-f="cases" min="0" step="0.5" value="'+(item.cases||0)+
      '" style="width:62px;'+inp+inpBdr+'" onchange="updateItemCases('+i+',this.value)" title="Cases ordered">';

    // QPC cell — editable, shows item QPC or blank
    var qpcVal  = qpc > 0 ? qpc : '';
    var qpcInp  = '<input type="number" data-f="qpc" min="0" value="'+qpcVal+
      '" placeholder="—" style="width:60px;'+inp+(qpc?inpBdr:inpRed)+
      '" onchange="updateItemQpc('+i+',this.value)" title="Qty per case — edit if not set">';

    // Order Qty — editable, red border if blank
    var qtyInp  = '<input type="number" data-f="qty" min="0" value="'+(item.totalQty||'')+
      '" placeholder="—" style="width:70px;'+inp+(!item.totalQty?inpRed:inpBdr)+
      '" onchange="updateItemQty('+i+',this.value)" title="Order Qty">';

    // Price cell
    var priceCell = item.sellingPrice > 0
      ? '<span style="cursor:pointer;font-weight:700;color:var(--blue-text);font-size:14px;white-space:nowrap" onclick="promptEditItemPrice('+i+')" title="Click to edit (password)">&#8377;'+item.sellingPrice+' &#9999;</span>'
      : '<input type="number" data-f="price" min="0" step="0.01" placeholder="Price" value="" style="width:92px;'+inp+inpRed+'" onchange="updateItemPrice('+i+',this.value)">';

    // Amount
    var amtCell = '<span style="font-weight:800;font-size:14px;white-space:nowrap">'+fmtMoney(item.totalAmount)+'</span>';

    return '<tr data-idx="'+i+'" style="border-bottom:1px solid var(--card-border)">'+
      '<td style="'+tdBorder+'color:var(--text-muted);font-size:13px;padding:10px 4px;text-align:center">'+(i+1)+'</td>'+
      '<td style="'+tdBorder+'font-weight:700;font-size:14px;padding:10px 10px;min-width:150px;max-width:260px;word-break:break-word">'+esc(item.productName)+'</td>'+
      '<td style="'+tdBorder+'padding:6px 4px;text-align:center">'+casesInp+'</td>'+
      '<td style="'+tdBorder+'padding:6px 4px;text-align:center">'+qpcInp+'</td>'+
      '<td style="'+tdBorder+'padding:6px 4px;text-align:center">'+qtyInp+'</td>'+
      '<td style="'+tdBorder+'font-size:13px;padding:10px 6px;text-align:center">'+esc(item.uom||'')+'</td>'+
      '<td style="'+tdBorder+'padding:10px 8px;text-align:right;min-width:100px">'+priceCell+'</td>'+
      '<td style="'+tdBorder+'padding:10px 8px;text-align:right;min-width:110px">'+amtCell+'</td>'+
      '<td style="'+tdBorder+'padding:6px 4px;text-align:center">'+
        '<input type="number" data-f="loaded" min="0" value="'+loaded+'" style="width:70px;'+inp+'color:'+pendInfo.color+';border:1.5px solid '+pendInfo.color+';" oninput="updateLoaded('+i+',this.value)" onchange="updateLoaded('+i+',this.value)" title="Qty Loaded">'+
      '</td>'+
      '<td id="bi-pend-'+i+'" style="'+tdBorder+'font-weight:700;font-size:15px;padding:10px 6px;text-align:center;color:'+pendInfo.color+'">'+pendInfo.text+'</td>'+
      '<td style="padding:6px 4px;text-align:center"><button class="btn btn-del btn-sm" onclick="removeBillItem('+i+')">&#10005;</button></td>'+
    '</tr>';
  }).join('');

  var totalPending = getBillPendingTotal();
  // always rendered (hidden at 0) so updateLoaded() can show/hide it live
  var pendingAlert = '<div id="bi-pending-alert" class="alert alert-warn" style="margin-bottom:8px'+(totalPending>0?'':';display:none')+'">&#9888;&#65039; <strong><span id="bi-pending-total">'+totalPending+'</span> units pending delivery</strong></div>';
  var countNote    = '<div style="font-size:13.5px;color:var(--text-muted);margin-bottom:8px">'+(q?'Showing '+visibleIdx.length+' of '+billItems.length+' items':billItems.length+' item'+(billItems.length===1?'':'s')+' in this estimate')+'</div>';
  var totalBar     = '<div style="margin-top:0;padding:12px 14px;background:rgba(245,158,11,0.08);border:1px solid var(--card-border);border-top:none;border-radius:0 0 12px 12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">'+
    '<span style="font-size:14px;color:var(--text-muted);font-weight:600">Total Cases: '+totalCases+'</span>'+
    '<span style="font-weight:800;font-size:19px;color:var(--red-text)">GRAND TOTAL: '+fmtMoney(total)+'</span>'+
  '</div>';

  if(!visibleIdx.length){
    return countNote+pendingAlert+'<div class="empty" style="padding:20px"><div class="empty-txt">No items match</div></div>'+(billItems.length?totalBar:'');
  }

  var thStyle = 'style="padding:13px 8px;font-size:13px;text-align:center;white-space:normal;border-right:1px solid rgba(255,255,255,0.15);line-height:1.3"';
  var thead = '<thead><tr>'+
    '<th '+thStyle+'>#</th>'+
    '<th style="padding:13px 10px;font-size:13px;text-align:left;border-right:1px solid rgba(255,255,255,0.15);min-width:120px">Item</th>'+
    '<th '+thStyle+'>Cases</th>'+
    '<th '+thStyle+'>Qty Per<br>Case</th>'+
    '<th '+thStyle+'>Order<br>Qty</th>'+
    '<th '+thStyle+'>UOM</th>'+
    '<th '+thStyle+' style="padding:13px 8px;min-width:100px;text-align:right;border-right:1px solid rgba(255,255,255,0.15)">Price</th>'+
    '<th '+thStyle+' style="padding:13px 8px;min-width:100px;text-align:right;border-right:1px solid rgba(255,255,255,0.15)">Amount</th>'+
    '<th style="padding:13px 8px;font-size:13px;text-align:center;background:rgba(245,158,11,0.16);color:#fbbf24;border-right:1px solid rgba(0,0,0,0.1)">Loaded<br>&#128666;</th>'+
    '<th style="padding:13px 8px;font-size:13px;text-align:center;background:rgba(245,158,11,0.16);color:#fbbf24;border-right:1px solid rgba(0,0,0,0.1)">Pending</th>'+
    '<th style="padding:6px 3px;font-size:13px"></th>'+
  '</tr></thead>';

  return countNote+pendingAlert+
    '<div class="tbl-wrap bi-items-scroll" style="border-radius:12px 12px 0 0;overflow-x:auto">'+
    '<table style="width:100%;border-collapse:collapse;min-width:860px">'+thead+'<tbody>'+rows+'</tbody></table></div>'+
    totalBar;
}

function buildBillItemsHtml(){
  if(!billItems.length){
    return '<div class="empty" style="padding:24px"><div class="empty-ico">&#128269;</div><div class="empty-txt">'+t('noItems')+'</div></div>';
  }
  var searchBox=billItems.length>3?'<div class="fg" style="margin-bottom:10px"><div class="srch-wrap"><span class="srch-ico">&#128269;</span><input class="srch-inp" id="bi-search" value="'+esc(billItemSearch)+'" placeholder="Search items in this bill..." autocomplete="off"></div></div>':'';
  return searchBox+'<div id="bi-table-wrap">'+buildBillItemsTableOnly()+'</div>';
}

function wireBillItemSearch(){
  var s=document.getElementById('bi-search');
  if(s && !s._wired){
    s._wired=true;
    s.addEventListener('input',function(e){
      billItemSearch=e.target.value;
      var w=document.getElementById('bi-table-wrap');
      if(w) w.innerHTML=buildBillItemsTableOnly();
    });
  }
}

function renderBilling(){
  var el=document.getElementById('pg-billing');
  var billNum=getBillNum();
  var refOpts=REF_LIST.map(function(r){return '<option value="'+r.id+'"'+(billRef===r.id?' selected':'')+'>#'+r.id+' &middot; '+esc(r.name)+'</option>';}).join('');
  var itemsHtml=buildBillItemsHtml();
  var editModeBar='';
  if(window._editingOriginalId){
    editModeBar='<div class="alert alert-warn" style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">'+
      '<span>&#9999;&#65039; <strong>Editing Estimate '+(window._editingOriginalBill?'#'+window._editingOriginalBill.billNumber:'')+'</strong></span>'+
      '<button class="btn btn-b btn-sm" onclick="goTab(\'home\')">&#127968; Exit &amp; Save</button>'+
    '</div>';
  }
  el.innerHTML=editModeBar+
    '<div class="sec-hdr"><h2 class="sec-title">&#129534; '+t('billing')+'</h2><span class="tag tag-r">#'+billNum+'</span></div>'+
    '<div class="card"><div class="card-title">&#128100; '+t('step1')+'</div>'+
      '<div class="grid2">'+
        '<div class="fg" style="margin-bottom:0;position:relative">'+
          '<label class="lbl">'+t('customer')+'</label>'+
          '<input class="inp" id="b-cust" value="'+esc(billCustomer)+'" placeholder="'+t('selectCust')+'" autocomplete="off">'+
          '<div class="ddl" id="b-cust-ddl"></div>'+
        '</div>'+
        '<div class="fg" style="margin-bottom:0">'+
          '<label class="lbl">'+t('refNum')+'</label>'+
          '<select class="sel" id="b-ref"><option value="">'+t('selectRef')+'</option>'+refOpts+'</select>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div class="card"><div class="card-title">&#128269; '+t('step2')+'</div>'+
      '<div class="fg">'+
        '<label class="lbl">Product Search</label>'+
        '<div class="srch-wrap">'+
          '<span class="srch-ico">&#128269;</span>'+
          '<input class="srch-inp" id="b-search" placeholder="'+t('searchProd')+'" autocomplete="off">'+
          '<div class="ddl" id="b-prod-ddl"></div>'+
        '</div>'+
      '</div>'+
      '<div id="b-sel-prod"></div>'+
    '</div>'+
    '<div class="card"><div class="card-title">&#128203; '+t('step3')+'</div>'+itemsHtml+
      /* Save button removed — bill autosaves on tab switch */
    '</div>';
  wireBilling();
}

function updateBillReference(newRef) {
  billRef = newRef || '';

  if (selectedProduct) {
    renderSelProd();
  }

  if (billItems && billItems.length > 0) {
    var updatedCount = 0;
    billItems.forEach(function(item) {
      var p = products.find(function(prod) {
        var pId = String(prod._id || prod.id || '').trim();
        var iId = String(item.productId || '').trim();
        var pName = cleanKey(prod.name);
        var iName = cleanKey(item.productName);
        return (pId && iId && pId === iId) || (pName && iName && pName === iName);
      });

      if (p) {
        var price = getPrice(p, billRef);
        if (price != null) {
          item.sellingPrice = Number(price);
          item.totalAmount = (item.totalQty || 0) * item.sellingPrice;
          updatedCount++;
        }
      }
    });

    onBillItemsChanged();
    renderBilling();
    if (updatedCount > 0) {
      toast('Updated ' + updatedCount + ' item price(s) for Reference #' + billRef, 'ok');
    }
  }
}

function wireBilling(){
  wireBillItemSearch();
  var custInp=document.getElementById('b-cust');
  var custDdl=document.getElementById('b-cust-ddl');
  var srch=document.getElementById('b-search');
  var prodDdl=document.getElementById('b-prod-ddl');
  var refSel=document.getElementById('b-ref');
  if(!custInp)return;
  custInp.addEventListener('input',function(){billCustomer=custInp.value;billCustomerId='';buildCustDdl(custDdl,custInp.value);});
  custInp.addEventListener('focus',function(){buildCustDdl(custDdl,custInp.value);});
  custInp.addEventListener('blur',function(){setTimeout(function(){custDdl.classList.remove('open');},200);});
  refSel.addEventListener('change',function(){updateBillReference(refSel.value);});
  srch.addEventListener('input',function(){
    var q=srch.value.trim();
    if(q.length<2){prodDdl.classList.remove('open');return;}
    var ql=q.toLowerCase();
    var res=products.filter(function(p){return (p.name||'').toLowerCase().indexOf(ql)>=0||(p.company||'').toLowerCase().indexOf(ql)>=0||(p.category||'').toLowerCase().indexOf(ql)>=0||(p.uom||'').toLowerCase().indexOf(ql)>=0;}).slice(0,18);
    if(!res.length){prodDdl.classList.remove('open');return;}
    prodDdl.innerHTML=res.map(function(p){
      var pr=getPrice(p,billRef);
      var st=((p.stock||0) - (reservationTotals[p._id]||0));
      return '<div class="ddi" onmousedown="selectBillProd(\''+encodeURIComponent(p.name)+'\')">'+
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">'+
          '<div><div class="mt">'+esc(p.name)+'</div><div class="st">'+esc(p.uom)+(p.qtyPerCase?' &middot; '+p.qtyPerCase+'/case':'')+' &middot; '+esc(p.category)+'</div>'+(p.qtyPerCase&&(p.stockCases||p.stockLoose)?'<div style="font-size:12px;color:var(--text-muted)">'+(p.stockCases||0)+'cs &times; '+p.qtyPerCase+(p.stockLoose?' + '+p.stockLoose+'L':'')+' = '+st+'</div>':'')+ '</div>'+
          '<div style="text-align:right;flex-shrink:0">'+(pr?'<div style="color:var(--red-text);font-weight:800;font-size:15px">&#8377;'+pr+'</div>':'<div style="color:var(--text-muted);font-size:13px">No price</div>')+
          '<span class="'+stockClass(st)+'">'+stockLabel(st)+'</span></div>'+
        '</div></div>';
    }).join('');
    prodDdl.classList.add('open');
  });
  srch.addEventListener('blur',function(){setTimeout(function(){prodDdl.classList.remove('open');},200);});
}

function buildCustDdl(ddl,val){
  var fl=customers.filter(function(c){return !val||c.name.toLowerCase().indexOf(val.toLowerCase())>=0;}).slice(0,10);
  ddl.innerHTML=fl.map(function(c){
    return '<div class="ddi" onmousedown="pickCust(\''+c._id+'\')"><div class="mt">'+esc(c.name)+'</div>'+(c.address?'<div class="st">'+esc(c.address)+'</div>':'')+'</div>';
  }).join('')+'<div class="ddi-add" onmousedown="addCustFromBill()">&#10010; Add "'+esc(val||'New Customer')+'"</div>';
  ddl.classList.add('open');
}

function pickCust(id){
  var c=customers.find(function(x){return x._id===id;});
  if(!c)return;
  billCustomer=c.name;billCustomerId=c._id;
  document.getElementById('b-cust').value=c.name;
  document.getElementById('b-cust-ddl').classList.remove('open');
  if(c.defaultRef){var s=document.getElementById('b-ref');if(s)s.value=c.defaultRef;updateBillReference(c.defaultRef);}
}

function addCustFromBill(){
  var nm=(document.getElementById('b-cust')||{}).value||'';
  if(!nm.trim())return;
  var nc={_id:genId(),name:nm.trim(),address:'',contact:'',defaultRef:billRef};
  customers.push(nc);saveAll();billCustomer=nc.name;billCustomerId=nc._id;
  document.getElementById('b-cust-ddl').classList.remove('open');
  toast('Customer added: '+nc.name);
}

function selectBillProd(id){
  // id is either a product name (encoded) or _id — try name first, then _id
  var decoded = '';
  try { decoded = decodeURIComponent(id); } catch(e) { decoded = id; }
  selectedProduct = products.find(function(p){ return p.name === decoded; }) ||
                    products.find(function(p){ return String(p._id) === String(id); }) ||
                    null;
  var s=document.getElementById('b-search');
  if(s&&selectedProduct)s.value=selectedProduct.name;
  document.getElementById('b-prod-ddl').classList.remove('open');
  renderSelProd();
}

function renderSelProd(){
  var el=document.getElementById('b-sel-prod');
  if(!el)return;
  var p=selectedProduct;
  if(!p){el.innerHTML='';return;}
  var price=getPrice(p,billRef);
  var st=((p.stock||0) - (reservationTotals[p._id]||0));
  var priceHtml=price
    ? '<div class="price-big">&#8377;'+price+'/'+esc(p.uom)+'</div>'
    : '<div style="color:#f59e0b;font-size:14px;font-weight:700">&#9432; No price set — enter in bill after adding</div>';
  var qtyHtml='';
  if(qtyMode==='cases'){
    qtyHtml=
      '<div class="grid2" style="margin-bottom:10px">'+
        '<div class="fg" style="margin-bottom:0">'+
          '<label class="lbl">No. of Cases'+(p.qtyPerCase?' (1 case = '+p.qtyPerCase+' '+esc(p.uom)+')':' <span style="color:#f59e0b;font-size:12px">(Qty per case not set — total qty = cases entered)</span>')+'</label>'+
          '<input class="inp" type="number" min="0" step="0.5" id="inp-cases" placeholder="e.g. 2" oninput="updateCalc()">'+
        '</div>'+
        '<div class="fg" style="margin-bottom:0"><label class="lbl">= Total Qty</label><input class="inp inp-ro" id="inp-tqty" readonly></div>'+
      '</div>';
  }else{
    qtyHtml='<div class="fg" style="margin-bottom:10px"><label class="lbl">Loose Quantity</label><input class="inp" type="number" min="0" id="inp-loose" placeholder="e.g. 120" oninput="updateCalc()"></div>';
  }
  el.innerHTML='<div class="sel-prod">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:12px">'+
      '<div><div style="font-weight:700;font-size:16px">'+esc(p.name)+'</div><div style="font-size:14px;color:var(--gy);margin-top:2px">'+esc(p.uom)+(p.qtyPerCase?' &middot; '+p.qtyPerCase+' per case':'')+' &middot; '+esc(p.category)+'</div></div>'+
      '<div style="text-align:right">'+priceHtml+'<span class="'+stockClass(st)+'" style="margin-top:4px;display:inline-block">&#128230; '+fmtNum(st)+' '+esc(p.uom)+'</span>'+(p.qtyPerCase?'<div style="font-size:12px;color:var(--gy);margin-top:2px">'+(p.stockCases||0)+'cs &times; '+p.qtyPerCase+(p.stockLoose?' + '+p.stockLoose+' loose':'')+'</div>':'')+'</div>'+
    '</div>'+
    '<div class="qty-toggle">'+
      '<div class="qty-opt'+(qtyMode==='cases'?' on':'')+'" onclick="setQtyMode(\'cases\')">&#128230; Cases</div>'+
      '<div class="qty-opt'+(qtyMode==='loose'?' on':'')+'" onclick="setQtyMode(\'loose\')">&#128290; Loose Qty</div>'+
    '</div>'+
    qtyHtml+
    '<div id="calc-prev"></div>'+
    '<button class="btn btn-g btn-xl" style="margin-top:10px" onclick="addBillItem()">&#10010; '+t('addItem')+(price?'':' (set price after)')+'</button>'+
  '</div>';
}

function setQtyMode(m){qtyMode=m;renderSelProd();}

function updateCalc(){
  var p=selectedProduct;if(!p)return;
  var price=getPrice(p,billRef);
  var totalQty=0;
  if(qtyMode==='cases'){
    var c=parseFloat((document.getElementById('inp-cases')||{}).value)||0;
    var effectiveQpc = p.qtyPerCase || 0;
    totalQty = effectiveQpc ? c * effectiveQpc : 0;
    var tq=document.getElementById('inp-tqty');if(tq)tq.value=effectiveQpc?totalQty:'';
  }else{
    totalQty=parseFloat((document.getElementById('inp-loose')||{}).value)||0;
  }
  var prev=document.getElementById('calc-prev');if(!prev)return;
  if(price&&totalQty>0){
    prev.innerHTML='<div class="calc-row"><span style="font-size:15px">'+
      (qtyMode==='cases'?(document.getElementById('inp-cases').value)+' cases &times; '+p.qtyPerCase+' = ':'')+
      totalQty+' '+esc(p.uom)+' &times; &#8377;'+price+'</span>'+
      '<span style="font-weight:800;font-size:20px;color:var(--red-text)">'+fmtMoney(totalQty*price)+'</span></div>';
  }else{prev.innerHTML='';}
}

window._activeDraftBillId = null;
window._autoSyncTimer = null;

function onBillItemsChanged() {
  if (!billCustomer.trim() && billItems.length === 0) return;

  if (!window._activeDraftBillId) {
    if (window._editingOriginalId) {
      window._activeDraftBillId = window._editingOriginalId;
    } else {
      window._activeDraftBillId = genId();
    }
  }

  var billNum = window._editingOriginalBill ? window._editingOriginalBill.billNumber : getBillNum();
  var isEdit = !!window._editingOriginalId;

  var total = billItems.reduce(function(s, i) { return s + (i.totalAmount || 0); }, 0);
  var totalCases = billItems.reduce(function(s, i) { return s + (i.cases || 0); }, 0);

  var draftBill = {
    _id: window._activeDraftBillId,
    billNumber: billNum,
    date: isEdit && window._editingOriginalBill ? (window._editingOriginalBill.date || new Date().toISOString()) : new Date().toISOString(),
    displayDate: isEdit && window._editingOriginalBill ? (window._editingOriginalBill.displayDate || todayDisp()) : todayDisp(),
    customerName: billCustomer.trim() || 'New Customer',
    customerId: billCustomerId,
    referenceNumber: billRef || '1',
    referenceName: REF_MAP[billRef || '1'] || ('Ref ' + (billRef || '1')),
    items: billItems.slice(),
    totalAmount: total,
    totalCases: totalCases,
    updatedAt: new Date().toISOString(),
    updatedBy: (typeof curUser !== 'undefined' && curUser && curUser.username) ? curUser.username : (lsGet('currentUser') || 'admin')
  };

  // Auto-save to local bills list and localStorage
  var idx = bills.findIndex(function(b) { return String(b._id) === String(draftBill._id); });
  if (idx >= 0) bills[idx] = draftBill;
  else bills.unshift(draftBill);

  saveAll();

  // Debounced live sync to the cloud
  if (cloudOn()) {
    clearTimeout(window._autoSyncTimer);
    window._autoSyncTimer = setTimeout(function() {
      saveBillToCloudSilently(draftBill, null);
    }, 600);
  }
}

function saveBillToCloudSilently(bill, oldItems) {
  // Auto-save draft to the cloud only — no PDF generation on autosave
  // PDF is only generated when bill is finalized via saveBillToCloud()
  if (!cloudOn()) return;
  apiCall('saveBill', { bill: bill, oldItems: oldItems || null, htmlContent: null }, function(res) {
    if (res.status === 'success') {
      console.log("Draft auto-synced to the cloud:", bill.billNumber);
    }
  });
}

function addBillItem(){
  var p=selectedProduct;if(!p)return;
  if(!billRef){toast('Select a Reference Number first!','err');return;}
  var price = getPrice(p, billRef) || 0; // 0 if no price set — editable inline after adding
  var totalQty = 0, cases2 = 0;
  if (qtyMode === 'cases') {
    cases2 = parseFloat((document.getElementById('inp-cases') || {}).value) || 0;
    // If QPC set use it, else treat cases as the order qty directly
    totalQty = p.qtyPerCase ? cases2 * p.qtyPerCase : 0; // blank qty if no QPC — user fills in bill
  } else {
    totalQty = parseFloat((document.getElementById('inp-loose') || {}).value) || 0;
  }
  // Allow adding even with 0 qty or 0 price — user fills in after adding the line

  billItems.push({
    productId:   p._id,
    productName: p.name,
    uom:         p.uom || 'BOX',
    cases:       cases2,
    qtyPerCase:  p.qtyPerCase || 0,
    looseQty:    qtyMode === 'loose' ? totalQty : 0,
    totalQty:    totalQty,
    costPrice:   p.costPrice || 0,
    sellingPrice: price,
    totalAmount: totalQty * price,
    qtyLoaded:   0,
    qtyPending:  totalQty
  });
  selectedProduct=null;
  billItemSearch='';
  onBillItemsChanged();
  // Refresh only the items table and selected product panel — not the full page
  // Full renderBilling() would rebuild customer/ref dropdowns losing state
  var itemsEl = document.getElementById('b-sel-prod');
  if (itemsEl) itemsEl.innerHTML = '';
  var tableWrap = document.getElementById('bi-table-wrap');
  if (tableWrap) {
    tableWrap.innerHTML = buildBillItemsTableOnly();
    wireBillItemSearch();
  } else {
    // First item added — need to render the full items card
    renderBilling();
  }
  scrollToLatestBillItem();
}

function scrollToLatestBillItem(){
  var wrap=document.getElementById('bi-table-wrap');
  if(!wrap)return;
  var rows=wrap.querySelectorAll('tbody tr');
  if(!rows.length)return;
  var target=rows[rows.length-1];
  target.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function removeBillItem(i){
  var it = billItems[i];
  var itemName = it ? it.productName : 'this item';
  if(!confirm('Remove "' + itemName + '" from the estimate?')) return;
  // Restore stock for the removed item immediately
  if (it && it.totalQty) {
    var pidx = products.findIndex(function(p){ return String(p._id) === String(it.productId) || cleanKey(p.name) === cleanKey(it.productName); });
    if (pidx >= 0) {
      var p = products[pidx];
      var qpc = p.qtyPerCase || 0;
      var newStock = (p.stock || 0) + Number(it.totalQty || 0);
      var newCases, newLoose;
      if (qpc > 0) {
        var absStk = Math.abs(newStock);
        var sign = newStock < 0 ? -1 : 1;
        newCases = sign * Math.floor(absStk / qpc);
        newLoose = sign * Math.round(absStk % qpc);
      } else { newCases = 0; newLoose = newStock; }
      products[pidx] = Object.assign({}, p, {stock: newStock, stockCases: newCases, stockLoose: newLoose});
      saveAll();
    }
  }
  billItems.splice(i, 1);
  onBillItemsChanged();
  renderBilling();
}

// Pending column in the estimate table = Loaded - Order Qty. The Loaded box
// uses the same colour as the Pending cell.
//   negative (still to load) -> blue, with "-"     e.g. -100  (on track, order still pending)
//   positive (over-loaded)   -> red, with "+"      e.g. +20   (loaded more than ordered - check it)
//   zero (exactly loaded)    -> green              e.g. 0
// Display only: item.qtyPending (units still owed, never below 0) keeps its
// meaning for the Pending Loads page, statements and the sheet.
function pendingDiffInfo(item){
  var diff=Math.round(((Number(item.qtyLoaded)||0)-(Number(item.totalQty)||0))*1000)/1000;
  return {
    text: diff>0?'+'+diff:String(diff),
    color: diff===0?'var(--green-text)':(diff>0?'var(--red-text)':'var(--blue-text)')
  };
}
function getBillPendingTotal(){
  return billItems.reduce(function(s,item){return s+(item.qtyPending!=null?item.qtyPending:item.totalQty);},0);
}
// Updates the Pending cell and the "units pending" banner in place, so the
// Loaded input keeps focus and the numbers change as you type.
function refreshPendingDisplay(i){
  var item=billItems[i];
  var cell=document.getElementById('bi-pend-'+i);
  if(cell&&item){
    var d=pendingDiffInfo(item);
    cell.textContent=d.text;
    cell.style.color=d.color;
    // the Loaded box takes the same colour as the Pending cell
    var loadBox=document.querySelector('#bi-table-wrap tr[data-idx="'+i+'"] input[data-f="loaded"]');
    if(loadBox){loadBox.style.color=d.color;loadBox.style.borderColor=d.color;}
  }
  var total=getBillPendingTotal();
  var banner=document.getElementById('bi-pending-alert');
  var num=document.getElementById('bi-pending-total');
  if(num)num.textContent=total;
  if(banner)banner.style.display=total>0?'':'none';
}

function updateLoaded(i,val){
  var loaded=parseFloat(val)||0;
  if(billItems[i]){
    billItems[i].qtyLoaded=loaded;
    billItems[i].qtyPending=Math.max(0,billItems[i].totalQty-loaded);
    refreshPendingDisplay(i);
  }
}

function updateItemPrice(i, val) {
  var price = parseFloat(val) || 0;
  if (!billItems[i]) return;

  var item = billItems[i];
  item.sellingPrice = price;
  item.totalAmount  = (item.totalQty || 0) * price;
  item.qtyPending   = Math.max(0, (item.totalQty || 0) - (item.qtyLoaded || 0));

  var targetRef = billRef || '1';

  // ── Save price back to product catalog (same as promptEditItemPrice) ────────
  var pIdx = products.findIndex(function(p) {
    var pId   = String(p._id || p.id || '').trim();
    var iId   = String(item.productId || '').trim();
    var pName = cleanKey(p.name);
    var iName = cleanKey(item.productName);
    return (pId && iId && pId === iId) || (pName && iName && pName === iName);
  });

  if (pIdx >= 0) {
    var prod = products[pIdx];
    if (!prod.prices) prod.prices = {};
    prod.prices[targetRef] = price;
    // Link productId if missing
    item.productId = prod._id || prod.id || item.productId;
    // Also update ALL_PRODUCTS if present
    if (typeof ALL_PRODUCTS !== 'undefined' && Array.isArray(ALL_PRODUCTS)) {
      var apIdx = ALL_PRODUCTS.findIndex(function(x) {
        return String(x._id || x.id || '').trim() === String(prod._id || '') ||
               cleanKey(x.name) === cleanKey(prod.name);
      });
      if (apIdx >= 0) {
        if (!ALL_PRODUCTS[apIdx].prices) ALL_PRODUCTS[apIdx].prices = {};
        ALL_PRODUCTS[apIdx].prices[targetRef] = price;
      }
    }
  }

  saveAll();
  onBillItemsChanged();

  // Ask user if price should update the master price list
  if (price > 0) {
    var refName2 = REF_MAP[targetRef] || ('Ref #' + targetRef);
    var updateMaster2 = confirm('Update master price list?\n\nProduct: ' + item.productName + '\nNew Price: Rs.' + price + '\nReference: ' + refName2 + '\n\nOK = Save to price list & upload to the cloud\nCancel = Apply to this bill only');
    if (updateMaster2) {
      if (pIdx >= 0) {
        if (!products[pIdx].prices) products[pIdx].prices = {};
        products[pIdx].prices[targetRef] = price;
      }
      saveAll();
      if (cloudOn()) {
        apiCall('updateProductPrice', {
          productId:   item.productId || (pIdx >= 0 ? products[pIdx]._id : ''),
          productName: item.productName,
          refId:       targetRef,
          price:       price
        }, function(res) {
          if (res.status === 'success') {
            toast('\u2705 Price \u20B9' + price + ' saved to ' + refName2 + ' & synced to the cloud!', 'ok');
          } else {
            toast('Price saved to catalog. Cloud sync failed: ' + (res.message||''), 'err');
          }
        });
      } else {
        toast('\u2705 Price \u20B9' + price + ' saved to catalog!', 'ok');
      }
    } else {
      toast('\u2705 Price \u20B9' + price + ' applied to this bill only.', 'ok');
    }
  }

  // Re-render bill table
  var w = document.getElementById('bi-table-wrap');
  if (w) w.innerHTML = buildBillItemsTableOnly();
  wireBillItemSearch();
}

function updateItemCases(i, val) {
  var cases = parseFloat(val);
  if (isNaN(cases) || cases < 0) cases = 0;
  if (billItems[i]) {
    var qpc = billItems[i].qtyPerCase || 0;
    billItems[i].cases = cases;
    if (qpc > 0) {
      var newQty = Math.round(cases * qpc);
      billItems[i].totalQty    = newQty;
      billItems[i].totalAmount = newQty * (billItems[i].sellingPrice || 0);
      billItems[i].qtyPending  = Math.max(0, newQty - (billItems[i].qtyLoaded || 0));
    }
    onBillItemsChanged();
    var w = document.getElementById('bi-table-wrap');
    if (w) w.innerHTML = buildBillItemsTableOnly();
    wireBillItemSearch();
  }
}

function updateItemQpc(i, val) {
  var qpc = parseFloat(val) || 0;
  if (billItems[i]) {
    billItems[i].qtyPerCase = qpc;
    if (qpc > 0 && billItems[i].cases > 0) {
      var newQty = Math.round(billItems[i].cases * qpc);
      billItems[i].totalQty    = newQty;
      billItems[i].totalAmount = newQty * (billItems[i].sellingPrice || 0);
      billItems[i].qtyPending  = Math.max(0, newQty - (billItems[i].qtyLoaded || 0));
      toast('Order Qty: ' + billItems[i].cases + ' × ' + qpc + ' = ' + newQty, 'ok');
    }
    onBillItemsChanged();
    var w = document.getElementById('bi-table-wrap');
    if (w) w.innerHTML = buildBillItemsTableOnly();
    wireBillItemSearch();
  }
}

function updateItemQty(i, val) {
  var qty = parseFloat(val);
  if (isNaN(qty) || qty < 0) qty = 0;
  if (billItems[i]) {
    var qpc = billItems[i].qtyPerCase || 0;
    billItems[i].totalQty    = qty;
    billItems[i].totalAmount = qty * (billItems[i].sellingPrice || 0);
    billItems[i].qtyPending  = Math.max(0, qty - (billItems[i].qtyLoaded || 0));
    // IMPORTANT: preserve cases — only update cases if QPC is known
    if (qpc > 0) {
      billItems[i].cases = Math.floor(qty / qpc);
    }
    // If QPC not set, cases stays as-is — user entered cases manually

    onBillItemsChanged();
    var w = document.getElementById('bi-table-wrap');
    if (w) w.innerHTML = buildBillItemsTableOnly();
    wireBillItemSearch();
  }
}

function computeBillDiff(oldItems, newItems) {
  oldItems = oldItems || [];
  newItems = newItems || [];

  var oldQtyMap = {};
  oldItems.forEach(function(item) {
    var key = String(item.productId || cleanKey(item.productName)).trim();
    oldQtyMap[key] = (oldQtyMap[key] || 0) + Number(item.totalQty || 0);
  });

  var newQtyMap = {};
  newItems.forEach(function(item) {
    var key = String(item.productId || cleanKey(item.productName)).trim();
    newQtyMap[key] = (newQtyMap[key] || 0) + Number(item.totalQty || 0);
  });

  var allKeys = {};
  for (var k1 in oldQtyMap) allKeys[k1] = true;
  for (var k2 in newQtyMap) allKeys[k2] = true;

  var diff = { added: [], removed: [], changed: [], unchanged: [] };

  for (var key in allKeys) {
    var oldQty = oldQtyMap[key] || 0;
    var newQty = newQtyMap[key] || 0;
    var delta = newQty - oldQty;
    var info = { key: key, oldQty: oldQty, newQty: newQty, delta: delta };

    if (oldQty === 0 && newQty > 0) diff.added.push(info);
    else if (oldQty > 0 && newQty === 0) diff.removed.push(info);
    else if (oldQty !== newQty) diff.changed.push(info);
    else diff.unchanged.push(info);
  }

  return diff;
}

function syncBillItemsFromDOM() {
  // Read latest values from bill table inputs before saving
  // Handles cases where user typed but onchange didn't fire (e.g. tab key)
  var rows = document.querySelectorAll('#bi-table-wrap tbody tr');
  rows.forEach(function(row) {
    // Identify the row and each box by name (data-idx / data-f), never by position:
    // a row's position changes while the "search items" filter is on, and the
    // Price cell becomes an extra input when an item has no price yet.
    var i = parseInt(row.getAttribute('data-idx'), 10);
    if (isNaN(i) || i < 0 || i >= billItems.length) return;

    var item   = billItems[i];
    if (!item) return;
    var casesEl = row.querySelector('input[data-f="cases"]');
    var qpcEl   = row.querySelector('input[data-f="qpc"]');
    var qtyEl   = row.querySelector('input[data-f="qty"]');
    var loadEl  = row.querySelector('input[data-f="loaded"]');
    var qpc     = item.qtyPerCase || 0;
    if (qpcEl && qpcEl.value !== '') {
      var qpcVal = parseFloat(qpcEl.value) || 0;
      if (qpcVal !== (item.qtyPerCase||0)) item.qtyPerCase = qpcVal;
    }

    // (item and qpc already defined above)
    

    // Read cases
    if (casesEl && casesEl.value !== '') {
      var cases = parseFloat(casesEl.value) || 0;
      if (cases !== item.cases) {
        item.cases = cases;
        if (qpc > 0) item.totalQty = Math.round(cases * qpc);
      }
    }
    // Read qty (overrides cases calculation)
    if (qtyEl && qtyEl.value !== '') {
      var qty = parseFloat(qtyEl.value) || 0;
      if (qty !== item.totalQty) {
        item.totalQty = qty;
        item.cases = qpc > 0 ? Math.floor(qty / qpc) : item.cases;
      }
    }
    // Read loaded
    if (loadEl && loadEl.value !== '') {
      item.qtyLoaded = parseFloat(loadEl.value) || 0;
    }

    item.totalAmount = (item.totalQty || 0) * (item.sellingPrice || 0);
    item.qtyPending  = Math.max(0, (item.totalQty || 0) - (item.qtyLoaded || 0));
    billItems[i] = item;
  });
}

function saveBill(silent){
  syncBillItemsFromDOM(); // Read latest input values before saving
  if(!billCustomer.trim()){if(!silent)toast('Please select a customer!','err');return false;}
  if(!billRef){if(!silent)toast('Please select a Reference Number!','err');return false;}
  if(!billItems.length){if(!silent)toast('Add at least one item!','err');return false;}

  var billNum = getBillNum();
  var existingBill = null;

  if (window._editingOriginalBill) {
    existingBill = window._editingOriginalBill;
  } else if (window._editingOriginalId) {
    existingBill = bills.find(function(b) { return String(b._id) === String(window._editingOriginalId); });
  } else if (window._activeDraftBillId) {
    // a new estimate: its auto-saved draft is found by its own id
    existingBill = bills.find(function(b) { return String(b._id) === String(window._activeDraftBillId); });
  }

  var isEdit = !!existingBill;
  var originalId = existingBill ? existingBill._id : genId();
  if (existingBill && existingBill.billNumber) {
    billNum = existingBill.billNumber;
    // a brand-new estimate whose number was meanwhile used by another device gets a fresh number
    if (!window._editingOriginalId && !window._editingOriginalBill) {
      var clash = bills.some(function(b) { return String(b._id) !== String(existingBill._id) && String(b.billNumber) === String(billNum); });
      if (clash) billNum = getBillNum();
    }
  }

  var oldItemsList = isEdit && existingBill && existingBill.items ? existingBill.items : [];
  var newItemsList = billItems.slice();

  // Compute explicit diff between previous saved state and newly submitted state
  var diff = computeBillDiff(oldItemsList, newItemsList);

  console.log('[Bill Diff Summary]:', {
    billNumber: billNum,
    isEdit: isEdit,
    added: diff.added,
    removed: diff.removed,
    changed: diff.changed,
    unchanged: diff.unchanged
  });

  // ── STOCK ADJUSTMENT ────────────────────────────────────────────
  // Build a map of qty changes: productId → delta (positive = deducted)
  var qtyChanges = {};
  // From old items — add back what was previously reserved
  oldItemsList.forEach(function(item) {
    var key = String(item.productId || '').trim();
    if (!key) key = '__name__' + cleanKey(item.productName);
    qtyChanges[key] = (qtyChanges[key] || 0) - Number(item.totalQty || 0);
  });
  // From new items — deduct new quantities
  newItemsList.forEach(function(item) {
    var key = String(item.productId || '').trim();
    if (!key) key = '__name__' + cleanKey(item.productName);
    qtyChanges[key] = (qtyChanges[key] || 0) + Number(item.totalQty || 0);
  });

  var changedProducts = [];

  // Apply adjustments to each product
  products.forEach(function(p, idx) {
    var keyById   = String(p._id || p.id || '').trim();
    var keyByName = '__name__' + cleanKey(p.name);

    var delta = 0;
    if (qtyChanges[keyById]   != null) delta = qtyChanges[keyById];
    else if (qtyChanges[keyByName] != null) delta = qtyChanges[keyByName];

    if (delta !== 0) {
      var qpc      = p.qtyPerCase || 0;
      var newStock = (p.stock || 0) - delta;

      var newCases, newLoose;
      if (qpc > 0) {
        // Always recalculate: total ÷ qpc = cases remainder = loose
        var absStk  = Math.abs(newStock);
        var sign    = newStock < 0 ? -1 : 1;
        newCases    = sign * Math.floor(absStk / qpc);
        newLoose    = sign * Math.round(absStk % qpc);
      } else {
        newCases = 0;
        newLoose = newStock;
      }

      console.log('[Stock] ' + p.name + ' | delta:' + delta + ' | ' + (p.stockCases||0) + 'cs+' + (p.stockLoose||0) + 'L → ' + newCases + 'cs+' + newLoose + 'L (total:' + newStock + ')');

      products[idx] = Object.assign({}, p, {
        stock:      newStock,
        stockCases: newCases,
        stockLoose: newLoose
      });
      changedProducts.push(products[idx]);
    }
  });

  // Save updated stock to localStorage immediately
  if (changedProducts.length > 0) {
    saveAll();
    // Push only the changed products to the cloud
    if (cloudOn()) {
      apiCall('updateStock', {products: changedProducts}, function(res) {
        if (res.status === 'success') {
          console.log('[Stock] Synced ' + changedProducts.length + ' product(s) to the cloud');
        }
      });
    }
  }
  // ── END STOCK ADJUSTMENT ─────────────────────────────────────────

  var total = billItems.reduce(function(s, i) { return s + (i.totalAmount || 0); }, 0);
  var totalCases = billItems.reduce(function(s, i) { return s + (i.cases || 0); }, 0);

  var bill = {
    _id: originalId,
    billNumber: billNum,
    date: isEdit && existingBill ? (existingBill.date || new Date().toISOString()) : new Date().toISOString(),
    displayDate: isEdit && existingBill ? (existingBill.displayDate || todayDisp()) : todayDisp(),
    customerName: billCustomer.trim(),
    customerId: billCustomerId,
    referenceNumber: billRef,
    referenceName: REF_MAP[billRef] || ('Ref ' + billRef),
    items: newItemsList,
    totalAmount: total,
    totalCases: totalCases,
    updatedAt: new Date().toISOString(),
    updatedBy: (typeof curUser !== 'undefined' && curUser && curUser.username) ? curUser.username : (lsGet('currentUser') || 'admin')
  };

  if (isEdit) {
    var idx = bills.findIndex(function(b) { return String(b._id) === String(originalId); });
    if (idx >= 0) bills[idx] = bill;
    else bills.unshift(bill);
  } else {
    bills.unshift(bill);
  }

  saveAll();
  apiReleaseAll(); // Release draft reservations
  if (isEdit) apiReleaseBillLock(originalId);
  billItems = []; billCustomer = ''; billCustomerId = ''; billRef = ''; selectedProduct = null; billItemSearch = '';
  window._editingBillParentId = null; window._editingBillVersion = null; window._editingOriginalId = null; window._editingOriginalBill = null;
  window._activeDraftSnapshot = null; window._activeDraftBillId = null;
  if (silent) {
    toast((isEdit ? 'Estimate #' + billNum + ' updated' : 'Estimate #' + billNum + ' saved') + ' — bill closed.', 'ok');
    // Don't force navigate — goTab already handles navigation to the intended tab
  } else {
    toast(isEdit ? 'Estimate updated!' : t('billSaved'));
    showBillPreview(bill);
    // Refresh history list in background so edited bill shows updated when user goes there
    if (typeof renderHistoryList === 'function') {
      setTimeout(function() {
        if (curTab === 'history') renderHistoryList();
      }, 300);
    }
  }
  saveBillToCloud(bill, oldItemsList);
  return true;
}

function editBill(id){
  if(userRole === 'employee') {
    toast('Access denied. Employees cannot edit estimates.','err');
    return;
  }
  var original = bills.find(function(b){ return String(b._id) === String(id); });
  if(!original){toast('Estimate not found','err');return;}

  closeModal(); // Close preview modal immediately so nav buttons are clickable
  apiAcquireBillLock(id, function(res){
    if (res && res.status === 'locked') {
      toast('\uD83D\uDD12 Estimate #' + original.billNumber + ' is being edited by ' + res.lockedBy + ' on another device. Opening view-only.', 'err');
      closeModal();
      showBillPreview(original);
      return;
    }

    window._editingOriginalBill = JSON.parse(JSON.stringify(original));
    window._editingOriginalId = String(original._id);

    billItems=original.items.map(function(item){
      var l = item.qtyLoaded != null ? Number(item.qtyLoaded) : 0;
      var p = item.qtyPending != null ? Number(item.qtyPending) : Math.max(0, (item.totalQty || 0) - l);
      return Object.assign({}, item, { qtyLoaded: l, qtyPending: p });
    });

    billCustomer=original.customerName;
    billCustomerId=original.customerId||'';
    billRef=original.referenceNumber||'';
    billItemSearch='';

    saveAll();
    closeModal();
    goTab('billing');
    toast('Editing estimate — overwriting estimate #' + original.billNumber,'ok');
  });
}

function cancelEdit(){
  if (window._editingOriginalId) apiReleaseBillLock(window._editingOriginalId);
  window._editingOriginalId=null;
  window._editingOriginalBill=null;
  billItems=[];
  billCustomer='';
  billCustomerId='';
  billRef='';
  billItemSearch='';
  selectedProduct=null;
  apiReleaseAll();
  renderBilling();
  toast('Edit cancelled','info');
}

// == BILL PREVIEW ==
function buildBillPreviewRows(bill, filterQ){
  var q=(filterQ||'').trim().toLowerCase();
  var items=bill.items||[];
  var visible=items.filter(function(item){return !q || item.productName.toLowerCase().indexOf(q)>=0;});
  var rows=visible.map(function(item){
    var i=items.indexOf(item);
    var loaded=item.qtyLoaded!=null?item.qtyLoaded:0;
    var pending=item.qtyPending!=null?item.qtyPending:(item.totalQty-loaded);
    var pendStyle=pending>0?'style="color:var(--red-text);font-weight:800"':'style="color:var(--green-text);font-weight:700"';
    return '<tr><td>'+(i+1)+'</td><td style="font-weight:700;font-size:14px">'+esc(item.productName)+'</td>'+
      '<td>'+(item.cases||'—')+'</td><td><strong>'+item.totalQty+'</strong></td>'+
      '<td>'+esc(item.uom)+'</td><td>&#8377;'+item.sellingPrice+'</td><td class="num">'+fmtMoney(item.totalAmount)+'</td>'+
      '<td style="text-align:center;font-weight:700;color:var(--sky-text)">'+loaded+'</td>'+
      '<td '+pendStyle+'>'+(pending>0?'⚠ ':'')+pending+'</td></tr>';
  }).join('');
  var countNote=q?'<div style="font-size:13.5px;color:var(--text-muted);margin-bottom:8px">Showing '+visible.length+' of '+items.length+' items</div>':'';
  var noMatch='<div class="empty" style="padding:16px"><div class="empty-txt">No items match "'+esc(filterQ)+'"</div></div>';
  return countNote+(visible.length?'<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Item</th><th>Cases</th><th>Qty</th><th>UOM</th><th>Price</th><th>Amount</th><th style="background:rgba(245,158,11,0.16);color:#fbbf24">Loaded &#128666;</th><th style="background:rgba(245,158,11,0.16);color:#fbbf24">Pending</th></tr></thead><tbody>'+
    rows+'<tr class="tr-total"><td colspan="2">Cases: '+esc(String(bill.totalCases||0))+'</td><td colspan="5" style="font-weight:700;text-align:right">TOTAL</td><td class="num" style="color:var(--red-text);font-size:17px" colspan="2">'+fmtMoney(bill.totalAmount)+'</td></tr>'+
    '</tbody></table></div>':noMatch);
}

function showBillPreview(bill){
  var searchBox=(bill.items||[]).length>3?'<div class="fg" style="margin-bottom:10px"><div class="srch-wrap"><span class="srch-ico">&#128269;</span><input class="srch-inp" id="bp-search" placeholder="Search items in this bill..." autocomplete="off"></div></div>':'';
  showModal(
    '<div class="modal" style="max-width:980px">'+
    '<div class="modal-hdr"><span class="modal-title">&#9989; Estimate Saved — #'+esc(bill.billNumber)+'</span><button class="modal-x" onclick="closeModal()">&#10005;</button></div>'+
    '<div class="modal-body">'+
      '<div class="alert alert-ok">&#9989; <strong>'+esc(bill.customerName)+'</strong> — '+fmtMoney(bill.totalAmount)+'</div>'+
      '<div class="bill-info">'+
        '<div class="bill-box"><div class="bl">Customer</div><div class="bv">'+esc(bill.customerName)+'</div></div>'+
        '<div class="bill-box"><div class="bl">Estimate #</div><div class="bv">#'+esc(bill.billNumber)+'</div></div>'+
        '<div class="bill-box"><div class="bl">Date</div><div class="bv">'+esc(bill.displayDate||'')+'</div></div>'+

      '</div>'+
      searchBox+
      '<div id="bp-rows-wrap">'+buildBillPreviewRows(bill,'')+'</div>'+
    '</div>'+
    '<div class="modal-ftr">'+
      '<button class="btn btn-gh" onclick="closeModal()">Close</button>'+
      (userRole === 'admin' ? (billLocks[bill._id] ? '<button class="btn btn-gh" disabled title="Locked — being edited by '+esc(billLocks[bill._id].username||'someone')+' on another device">&#128274; Locked</button>' : '<button class="btn btn-o" onclick="editBill(\''+bill._id+'\');">&#9999; Edit Estimate</button>') : '')+
      '<button class="btn btn-b" onclick="printBill(\''+bill._id+'\')">&#128424; Print</button>'+
      '<button class="btn btn-r" onclick="downloadBill(\''+bill._id+'\')">&#8681; PDF</button>'+
      '<button class="btn" style="background:#25D366;color:#fff" onclick="shareBillWhatsApp(\''+bill._id+'\')">&#128241; Share via WhatsApp</button>'+
    '</div></div>'
  );
  var s=document.getElementById('bp-search');
  if(s){
    s.addEventListener('input',function(e){
      var w=document.getElementById('bp-rows-wrap');
      if(w) w.innerHTML=buildBillPreviewRows(bill,e.target.value);
    });
  }
}

// == PRINT / PDF ==
// Aggregates a single customer's bill history: count, total billed, pending
// load value (qty still owed to them, priced at each item's own selling
// price), advance paid (a plain editable field on the customer record),
// and the resulting balance due.
function buildCustomerStats(customer){
  var theirBills=bills.filter(function(b){return (b.customerName||'')===(customer.name||'');});
  var payments=customer.advancePayments||[];
  var totalBilled=0, pendingValue=0, totalAdvance=0;

  var ledger=[];
  theirBills.forEach(function(b){
    totalBilled+=Number(b.totalAmount||0);
    var billPending=0;
    (b.items||[]).forEach(function(item){
      var pending=item.qtyPending!=null?Number(item.qtyPending):0;
      if(pending>0) billPending+=pending*Number(item.sellingPrice||0);
    });
    pendingValue+=billPending;
    ledger.push({type:'bill',date:b.date,displayDate:b.displayDate||fmtDateDMY(b.date),billNumber:b.billNumber,estimateAmount:Number(b.totalAmount||0),paymentAmount:0,pendingAmount:billPending});
  });
  payments.forEach(function(p){
    var amt=Number(p.amount||0);
    totalAdvance+=amt;
    ledger.push({type:'advance',date:p.date,displayDate:fmtDateDMY(p.date),estimateAmount:0,paymentAmount:amt,pendingAmount:0});
  });
  ledger.sort(function(a,b){return new Date(a.date)-new Date(b.date);});

  return {
    bills:theirBills,
    ledger:ledger,
    billCount:theirBills.length,
    totalBilled:totalBilled,
    pendingValue:pendingValue,
    advancePaid:totalAdvance,
    payments:payments,
    // Balance due = total estimated − total paid − total pending load value.
    // This can legitimately go negative (we owe them, in effect) — no
    // clamping, the true signed number is what matters here.
    balanceDue:totalBilled-totalAdvance-pendingValue
  };
}

function buildCustomerStatementHTML(customer,stats){
  var rows=stats.ledger.map(function(row){
    var ref=row.type==='advance'?'Advance Payment':'Estimate #'+esc(row.billNumber);
    return '<tr'+(row.type==='advance'?' style="background:#f0fdf4"':'')+'><td>'+row.displayDate+'</td>'+
      '<td style="font-weight:700'+(row.type==='advance'?';color:#16a34a':'')+'">'+ref+'</td>'+
      '<td style="text-align:right">'+(row.estimateAmount?'&#8377;'+row.estimateAmount.toLocaleString('en-IN',{minimumFractionDigits:2}):'—')+'</td>'+
      '<td style="text-align:right;color:#16a34a">'+(row.paymentAmount?'&#8377;'+row.paymentAmount.toLocaleString('en-IN',{minimumFractionDigits:2}):'—')+'</td>'+
      '<td style="text-align:right;color:#dc2626">'+(row.pendingAmount?'&#8377;'+row.pendingAmount.toLocaleString('en-IN',{minimumFractionDigits:2}):'—')+'</td></tr>';
  }).join('');
  var totRow='<tr style="background:#e5e7eb;font-weight:800"><td colspan="2">TOTAL</td>'+
    '<td style="text-align:right">&#8377;'+stats.totalBilled.toLocaleString('en-IN',{minimumFractionDigits:2})+'</td>'+
    '<td style="text-align:right;color:#16a34a">&#8377;'+stats.advancePaid.toLocaleString('en-IN',{minimumFractionDigits:2})+'</td>'+
    '<td style="text-align:right;color:#dc2626">&#8377;'+stats.pendingValue.toLocaleString('en-IN',{minimumFractionDigits:2})+'</td></tr>';
  var dueSign=stats.balanceDue<0?'-':'+';
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;padding:20px;color:#000}.hdr{background:#374151;color:#fff;padding:14px;text-align:center;border-radius:8px 8px 0 0;margin-bottom:10px}.hdr h1{font-size:19px;margin-bottom:2px}.hdr p{font-size:11px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}.mb{background:#f3f4f6;border:1px solid #d1d5db;padding:8px;border-radius:6px}.mb label{display:block;font-size:9px;font-weight:700;color:#374151;text-transform:uppercase}.mb span{font-size:13px;font-weight:700}.stat{border:2px solid #dc2626;border-radius:6px;padding:10px;text-align:center;margin-bottom:14px}.stat label{display:block;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:3px}.stat span{font-size:20px;font-weight:800;color:#dc2626}table{width:100%;border-collapse:collapse;margin-top:6px}th{background:#374151;color:#fff;padding:7px 6px;text-align:left;font-size:11px}td{padding:5px 6px;border-bottom:1px solid #f3f4f6;font-size:11px}.ftr{margin-top:16px;border-top:1px solid #ccc;padding-top:10px;display:flex;justify-content:space-between}@media print{body{padding:0}}</style></head><body>'+
    '<div class="hdr"><h1>Customer Statement</h1></div>'+
    '<div class="meta">'+
      '<div class="mb"><label>Customer</label><span>'+esc(customer.name||'')+'</span></div>'+
      '<div class="mb"><label>Contact</label><span>'+esc(customer.contact||'—')+'</span></div>'+
    '</div>'+
    '<table><thead><tr><th>Date</th><th>Reference</th><th style="text-align:right">Estimate Amount</th><th style="text-align:right">Payment Amount</th><th style="text-align:right">Pending Loads Amount</th></tr></thead><tbody>'+rows+totRow+'</tbody></table>'+
    '<div class="stat" style="margin-top:14px"><label>Total Due (Estimate − Payment − Pending Loads)</label><span>'+dueSign+'&#8377;'+Math.abs(stats.balanceDue).toLocaleString('en-IN',{minimumFractionDigits:2})+'</span></div>'+
    '<div class="ftr"><div><small>Thank you! &#128150;</small></div><div style="text-align:right"><p>Authorized Signature</p><div style="border-top:1px solid #000;width:140px;margin-top:24px;padding-top:4px">___________________</div></div></div>'+
    '</body></html>';
}

function printCustomerStatement(id){
  var customer=customers.find(function(c){return String(c._id)===String(id);});
  if(!customer){toast('Customer not found','err');return;}
  var stats=buildCustomerStats(customer);
  var w=window.open('','_blank','width=900,height=700');
  w.document.write(buildCustomerStatementHTML(customer,stats));
  w.document.close();
  setTimeout(function(){w.print();},500);
}

// Generates the statement PDF via the backend (uploaded to cloud storage, link made
// shareable) and opens WhatsApp with that link pre-filled — same pattern as
// sharing a bill's PDF, just for a customer's consolidated statement.
function shareCustomerStatementWhatsApp(id){
  var customer=customers.find(function(c){return String(c._id)===String(id);});
  if(!customer){toast('Customer not found','err');return;}
  var stats=buildCustomerStats(customer);
  var htmlContent=buildCustomerStatementHTML(customer,stats);
  toast('Generating statement PDF...','info');
  apiCall('saveCustomerStatement',{customerName:customer.name,htmlContent:htmlContent},function(res){
    if(res && res.status==='success' && res.fileUrl){
      var fname = res.fileName || (customer.name.replace(/\s+/g,'_')+'_Statement.pdf');
      var msg='GLT Fireworks — Statement for '+customer.name+'\n'+
        'Total Bills: '+stats.billCount+'\n'+
        'Total Billed: '+fmtMoney(stats.totalBilled)+'\n'+
        'Advance Paid: '+fmtMoney(stats.advancePaid)+'\n'+
        'Balance Due: '+fmtMoney(stats.balanceDue)+'\n\n'+
        'View / Download PDF:\n'+res.fileUrl;
      window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
    }else{
      toast('Failed to generate statement PDF: '+(res&&res.message?res.message:'unknown error'),'err');
    }
  });
}

function buildBillHTML(bill){
  var rows=(bill.items||[]).map(function(item,i){
    var loaded=item.qtyLoaded!=null?item.qtyLoaded:0;
    var pending=item.qtyPending!=null?item.qtyPending:(item.totalQty-loaded);
    var pendColor=pending>0?'#dc2626':'#16a34a';
    return '<tr style="background:'+(i%2?'#fefcfc':'#fff')+'">'+
      '<td>'+(i+1)+'</td><td><strong>'+esc(item.productName)+'</strong></td>'+
      '<td>'+(item.cases||'—')+'</td><td>'+(item.qtyPerCase||'—')+'</td>'+
      '<td><strong>'+item.totalQty+'</strong></td><td>'+esc(item.uom)+'</td>'+
      '<td>&#8377;'+item.sellingPrice+'</td>'+
      '<td style="font-weight:700;text-align:right">&#8377;'+Number(item.totalAmount).toLocaleString('en-IN',{minimumFractionDigits:2})+'</td>'+
      '<td style="font-weight:700;text-align:center;color:#0284c7">'+loaded+'</td>'+
      '<td style="font-weight:700;text-align:center;color:'+pendColor+'">'+(pending>0?'⚠ ':'')+pending+'</td></tr>';
  }).join('');
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;padding:20px;color:#000}.hdr{background:#dc2626;color:#fff;padding:14px;text-align:center;border-radius:8px 8px 0 0;margin-bottom:10px}.hdr h1{font-size:22px;margin-bottom:2px}.hdr p{font-size:11px}.meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px}.mb{background:#fef2f2;border:1px solid #fca5a5;padding:8px;border-radius:6px}.mb label{display:block;font-size:9px;font-weight:700;color:#7f1d1d;text-transform:uppercase}.mb span{font-size:13px;font-weight:700}table{width:100%;border-collapse:collapse}th{background:#dc2626;color:#fff;padding:7px 6px;text-align:left;font-size:11px}td{padding:5px 6px;border-bottom:1px solid #f3f4f6;font-size:11px}.tot{background:#fef9c3;font-weight:700;font-size:13px}.ftr{margin-top:16px;border-top:1px solid #ccc;padding-top:10px;display:flex;justify-content:space-between}@media print{body{padding:0}}</style></head><body>'+
    '<div class="hdr"><h1>GLT FIREWORKS</h1><p>Gollagunta | Wholesale &amp; Retail Fireworks</p><p style="margin-top:4px;font-size:12px;font-weight:700">Contact: Sai Reddy, 9440116712</p></div>'+
    '<div class="meta">'+
      '<div class="mb"><label>Customer</label><span>'+esc(bill.customerName||'')+'</span></div>'+
      '<div class="mb"><label>Estimate Number</label><span>#'+esc(bill.billNumber)+'</span></div>'+
      '<div class="mb"><label>Date</label><span>'+(bill.displayDate||'')+'</span></div>'+

    '</div>'+
    '<table><thead><tr><th>#</th><th>ITEM</th><th>CASES</th><th>QTY/CASE</th><th>TOTAL QTY</th><th>UOM</th><th>PRICE</th><th>AMOUNT</th><th>LOADED</th><th>PENDING</th></tr></thead>'+
    '<tbody>'+rows+'<tr class="tot"><td colspan="4">Cases: '+(bill.totalCases||0)+'</td><td colspan="4">GRAND TOTAL</td><td style="text-align:right" colspan="2">&#8377;'+Number(bill.totalAmount||0).toLocaleString('en-IN',{minimumFractionDigits:2})+'</td></tr></tbody></table>'+
    '<div class="ftr"><div><strong>GLT FIREWORKS, GOLLAGUNTA</strong><br><small>Thank you! &#128150;</small></div><div style="text-align:right"><p>Authorized Signature</p><div style="border-top:1px solid #000;width:140px;margin-top:24px;padding-top:4px">___________________</div></div></div>'+
    '</body></html>';
}

function printBill(id){
  var bill=bills.find(function(b){return b._id===id;});
  if(!bill)return;
  var w=window.open('','_blank','width=900,height=700');
  w.document.write(buildBillHTML(bill));
  w.document.close();
  setTimeout(function(){w.print();},500);
}

// == PDF DOWNLOAD (built in the browser, saved straight to Downloads) ==
// The bill / statement HTML is rendered off-screen, captured with html2canvas
// and paged onto A4 with jsPDF. Both libraries are fetched on first use only.
var PDF_LIB_HTML2CANVAS='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
var PDF_LIB_JSPDF='https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
var _pdfBusy=false;

function pdfSafeName(s){
  // keep letters (incl. Telugu) and digits; drop characters Windows forbids in file names
  return String(s||'').replace(/[\\\/:*?"<>|]+/g,'').trim().replace(/\s+/g,'_');
}
// ddmmhhMM of the moment the PDF is generated (day, month, hour 24h, minute)
function pdfStamp(){var d=new Date();return pad(d.getDate())+pad(d.getMonth()+1)+pad(d.getHours())+pad(d.getMinutes());}

function loadPdfLibs(){
  function load(src,ready){
    if(ready())return Promise.resolve();
    return new Promise(function(resolve,reject){
      var s=document.createElement('script');
      s.src=src;
      s.onload=resolve;
      s.onerror=function(){reject(new Error('Could not load '+src));};
      document.head.appendChild(s);
    });
  }
  return load(PDF_LIB_HTML2CANVAS,function(){return !!window.html2canvas;})
    .then(function(){return load(PDF_LIB_JSPDF,function(){return !!(window.jspdf&&window.jspdf.jsPDF);});});
}

// Builds the PDF. Saves it to Downloads under `fname`, or - when asBlob is true -
// resolves with the PDF file itself (used to upload a shareable link to the cloud).
function renderHtmlToPdfFile(html,fname,asBlob){
  return new Promise(function(resolve,reject){
    var fr=document.createElement('iframe');
    fr.setAttribute('aria-hidden','true');
    fr.style.cssText='position:fixed;left:-10000px;top:0;width:794px;height:1200px;border:0;pointer-events:none';
    document.body.appendChild(fr);
    function done(err,val){ if(fr.parentNode)fr.parentNode.removeChild(fr); if(err)reject(err); else resolve(val); }
    try{
      var doc=fr.contentDocument;
      doc.open();doc.write(html);doc.close();
    }catch(e){done(e);return;}
    setTimeout(function(){
      try{
        var body=fr.contentDocument.body;
        var h=Math.ceil(body.getBoundingClientRect().height); // the document's own height, not the iframe viewport's
        fr.style.height=h+'px';
        // bottoms of rows / blocks = places where a page may safely break
        var top=body.getBoundingClientRect().top, breaks=[];
        [].forEach.call(fr.contentDocument.querySelectorAll('tr,.hdr,.meta,.stat,.ftr'),function(el){
          breaks.push(el.getBoundingClientRect().bottom-top);
        });
        window.html2canvas(body,{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false,width:794,windowWidth:794,height:h,windowHeight:h}).then(function(canvas){
          var pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4',orientation:'portrait',compress:true});
          var pageW=210,pageH=297,mX=5,mY=8,imgW=pageW-2*mX;
          var pxPerMm=canvas.width/imgW;
          var maxSlice=Math.floor((pageH-2*mY)*pxPerMm);
          var k=canvas.width/794;
          var cuts=breaks.map(function(b){return Math.round(b*k);}).sort(function(a,b){return a-b;});
          var y=0,first=true;
          while(y<canvas.height-1){
            var end=Math.min(y+maxSlice,canvas.height);
            if(end<canvas.height){
              var best=0;
              cuts.forEach(function(c){ if(c>y+20&&c<=end&&c>best)best=c; });
              if(best)end=best;
            }
            // only the page's bottom padding is left -> absorb it instead of adding a blank page
            if(canvas.height-end<60)end=canvas.height;
            var sh=end-y;
            var part=document.createElement('canvas');
            part.width=canvas.width;part.height=sh;
            var ctx=part.getContext('2d');
            ctx.fillStyle='#ffffff';ctx.fillRect(0,0,part.width,sh);
            ctx.drawImage(canvas,0,y,canvas.width,sh,0,0,canvas.width,sh);
            if(!first)pdf.addPage();
            pdf.addImage(part.toDataURL('image/jpeg',0.95),'JPEG',mX,mY,imgW,sh/pxPerMm);
            first=false;y=end;
          }
          if(asBlob){ done(null,pdf.output('blob')); }
          else{ pdf.save(fname+'.pdf'); done(); }
        }).catch(done);
      }catch(e){done(e);}
    },400);
  });
}

function renderHtmlToPdfBlob(html){ return renderHtmlToPdfFile(html,'',true); }

// Last-resort path if the PDF libraries can't be loaded (e.g. offline):
// the old print-dialog route, with the intended file name as the window title.
function printHtmlFallback(html,fname){
  var w=window.open('','_blank','width=900,height=700');
  if(!w)return;
  w.document.write(html);
  w.document.close();
  w.document.title=fname+'.pdf';
  setTimeout(function(){w.print();},600);
}

function downloadPdfFromHtml(html,fname){
  if(_pdfBusy)return;
  _pdfBusy=true;
  toast('Preparing PDF...');
  loadPdfLibs()
    .then(function(){return renderHtmlToPdfFile(html,fname);})
    .then(function(){toast('Downloaded '+fname+'.pdf');})
    .catch(function(err){
      console.error('PDF download failed:',err);
      toast('Could not create the PDF directly - opening print dialog instead.','err');
      printHtmlFallback(html,fname);
    })
    .then(function(){_pdfBusy=false;});
}

// File name: CustomerName_BillNo_ddmmhhMMbill.pdf
function downloadBill(id){
  var bill=bills.find(function(b){return b._id===id;});
  if(!bill)return;
  var fname=(pdfSafeName(bill.customerName)||'Customer')+'_'+pdfSafeName(bill.billNumber)+'_'+pdfStamp()+'bill';
  downloadPdfFromHtml(buildBillHTML(bill),fname);
}

// File name: CustomerName_ddmmhhMM_summary.pdf
function downloadCustomerStatementPdf(id){
  var customer=customers.find(function(c){return String(c._id)===String(id);});
  if(!customer){toast('Customer not found','err');return;}
  var stats=buildCustomerStats(customer);
  var fname=(pdfSafeName(customer.name)||'Customer')+'_'+pdfStamp()+'_summary';
  downloadPdfFromHtml(buildCustomerStatementHTML(customer,stats),fname);
}

// Shares the bill's cloud-hosted PDF link via WhatsApp. Opens WhatsApp with
// the message pre-filled and no fixed recipient, so WhatsApp itself shows
// the contact picker to choose who to send it to. Requires the bill to have
// already synced once (pdfUrl set) — bills saved before this feature, or
// saved while offline, won't have a link yet.
function shareBillWhatsApp(id){
  var bill=bills.find(function(b){return b._id===id;});
  if(!bill){toast('Estimate not found','err');return;}

  function openWA(url){
    var msg='GLT Fireworks — Estimate #'+bill.billNumber+'\n'+
      'Customer: '+bill.customerName+'\n'+
      'Date: '+(bill.displayDate||'')+'\n'+
      'Amount: '+fmtMoney(bill.totalAmount)+'\n\n'+
      'View / Download PDF:\n'+url;
    window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
  }

  if(bill.pdfUrl){
    openWA(bill.pdfUrl);
    return;
  }

  // PDF not generated yet — generate it now then share
  if(!cloudOn()){
    toast('Log in first to create a shareable PDF link.','err');
    return;
  }
  toast('&#8987; Generating PDF link...','info');
  var htmlContent = buildBillHTML(bill);
  apiCall('saveBill', {bill: bill, oldItems: null, htmlContent: htmlContent}, function(res){
    if(res && res.status==='success' && res.fileUrl){
      bill.pdfUrl = res.fileUrl;
      // Find and update in bills array
      var idx = bills.findIndex(function(b){ return b._id === bill._id; });
      if(idx >= 0) bills[idx] = bill;
      saveAll();
      openWA(res.fileUrl);
    } else {
      toast('PDF link failed: '+((res&&(res.warning||res.message))||'check the internet connection and try again')+'','err');
    }
  });
}

// == INVENTORY ==
function renderInventory(){
  var el=document.getElementById('pg-inventory');
  var filterBtns=[['all',t('filterAll')],['in',t('filterIn')],['low',t('filterLow')],['out',t('filterOut')],['neg',t('filterNeg')]].map(function(x){
    return '<button class="btn '+(invFilter===x[0]?'btn-r':'btn-gh')+'" onclick="setInvFilter(\''+x[0]+'\')">'+x[1]+'</button>';
  }).join('');

  el.innerHTML=
    '<div class="sec-hdr"><h2 class="sec-title">&#128230; '+t('inventory')+'</h2>'+(userRole==='admin'?'<button class="btn btn-r" onclick="showAddModal()">&#10010; '+t('addProd')+'</button>':'')+'</div>'+
    '<div class="card" style="margin-bottom:12px">'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
        '<div class="srch-wrap" style="flex:1;min-width:200px"><span class="srch-ico">&#128269;</span><input class="srch-inp" id="inv-srch" value="'+esc(invSearch)+'" placeholder="Search name or category..."></div>'+
        '<div class="btn-row">'+filterBtns+'</div>'+
        '<span class="tag tag-gy" id="inv-count-tag">0 items</span>'+
      '</div>'+
    '</div>'+
    '<div id="inv-cards-wrap"></div>'+
    '<div id="inv-pag-wrap"></div>';

  var srchInp=document.getElementById('inv-srch');
  if(srchInp){
    srchInp.addEventListener('input',function(e){
      invSearch=e.target.value;
      invPage=1;
      updateInventoryCardsOnly();
    });
  }

  updateInventoryCardsOnly();
}

function updateInventoryCardsOnly(){
  var list=products.slice();
  if(invSearch){
    var q=invSearch.toLowerCase();
    list=list.filter(function(p){
      return (p.name||'').toLowerCase().indexOf(q)>=0||(p.company||'').toLowerCase().indexOf(q)>=0||(p.category||'').toLowerCase().indexOf(q)>=0||(p.uom||'').toLowerCase().indexOf(q)>=0;
    });
  }
  if(invFilter==='low')list=list.filter(function(p){return (p.stock||0)>0&&(p.stock||0)<50;});
  else if(invFilter==='out')list=list.filter(function(p){return (p.stock||0)===0;});
  else if(invFilter==='neg')list=list.filter(function(p){return (p.stock||0)<0;});
  else if(invFilter==='in')list=list.filter(function(p){return (p.stock||0)>=50;});

  var pages=Math.ceil(list.length/INV_PER)||1;
  if(invPage>pages)invPage=1;
  var paged=list.slice((invPage-1)*INV_PER,invPage*INV_PER);

  function sColor(n){return n>=50?'var(--green-text)':n>0?'var(--orange-text)':'var(--red-text)';}

  var cards=paged.map(function(p){
    var st=((p.stock||0) - (reservationTotals[p._id]||0));
    return '<div class="inv-card">'+
      '<div class="inv-name">'+esc(p.name)+'</div>'+
      '<div class="inv-co">'+(p.qtyPerCase?p.qtyPerCase+'/case &middot; ':'')+esc(p.uom)+(p.category?' &middot; '+esc(p.category):'')+'</div>'+
      '<div style="display:flex;align-items:baseline;gap:6px;margin-bottom:4px;flex-wrap:wrap">'+
        '<span class="inv-stk" style="color:'+sColor(st)+'">'+fmtNum(st)+'</span>'+
        '<span style="color:var(--gy);font-size:14px">'+esc(p.uom)+'</span>'+
        '<span class="'+stockClass(st)+'" style="margin-left:4px">'+(st>=50?'&#9989; OK':st>0?'&#9888;&#65039; Low':st<0?'&#128683; Oversold':'&#10060; No Stock')+'</span>'+
      '</div>'+
      (p.qtyPerCase?'<div style="font-size:13px;color:var(--text-muted);margin-bottom:4px">'+
        (p.stockCases?p.stockCases+' cases &times; '+p.qtyPerCase:'0 cases')+
        (p.stockLoose?' + '+p.stockLoose+' loose':'')+'</div>':'')+
      (p.costPrice&&userRole==='admin'?'<div style="font-size:13px;color:var(--gy)">Cost: &#8377;'+p.costPrice+'</div>':'')+
      (p.category?'<span class="tag tag-gy" style="font-size:12px;margin-top:2px">'+esc(p.category)+'</span>':'')+
      (userRole==='admin'?'<div class="inv-actions">'+
        '<button class="btn btn-gh btn-sm" onclick="showStockModal(\''+p._id+'\')">&#128230; Stock</button>'+
        '<button class="btn btn-gh btn-sm" onclick="showEditModal(\''+p._id+'\')">&#9999;&#65039; Edit</button>'+
        '<button class="btn btn-del btn-sm" onclick="delProd(\''+p._id+'\')">&#128465;&#65039;</button>'+
      '</div>':'')+'</div>';
  }).join('');

  var pagHtml='';
  if(pages>1){
    pagHtml='<div class="pag">'+
      '<button class="btn btn-gh btn-sm" onclick="setInvPage('+(invPage-1)+')"'+(invPage===1?' disabled':'')+'>&#8592; Prev</button>'+
      '<span style="font-size:15px;padding:6px 10px">Page '+invPage+' of '+pages+'</span>'+
      '<button class="btn btn-gh btn-sm" onclick="setInvPage('+(invPage+1)+')"'+(invPage>=pages?' disabled':'')+'>Next &#8594;</button>'+
    '</div>';
  }

  var countTag=document.getElementById('inv-count-tag');
  if(countTag) countTag.innerText=list.length+' items';

  var cardsWrap=document.getElementById('inv-cards-wrap');
  if(cardsWrap){
    cardsWrap.innerHTML=paged.length?'<div class="inv-grid">'+cards+'</div>':'<div class="empty"><div class="empty-ico">&#128230;</div><div class="empty-txt">No products found</div></div>';
  }

  var pagWrap=document.getElementById('inv-pag-wrap');
  if(pagWrap){
    pagWrap.innerHTML=pagHtml;
  }
}

function setInvFilter(f){invFilter=f;invPage=1;renderInventory();}
function setInvPage(p){invPage=Math.max(1,p);updateInventoryCardsOnly();document.getElementById('pages').scrollTop=0;}

function showStockModal(id){
  var p=products.find(function(x){return x._id===id;});if(!p)return;
  window._stkProd=p;window._stkInputMode='combined';window._stkOp='add';
  var qpc=p.qtyPerCase||null;
  var qpcInfo=qpc?'('+qpc+' per case)':'(no case size set)';
  showModal('<div class="modal" style="max-width:480px">'+
    '<div class="modal-hdr"><span class="modal-title">&#128230; Update Stock</span><button class="modal-x" onclick="closeModal()">&#10005;</button></div>'+
    '<div class="modal-body">'+
      '<div style="font-weight:700;margin-bottom:6px;font-size:15px">'+esc(p.name)+'</div>'+
      '<div class="stock-live-preview" id="stkLivePrev">'+
        '<div class="sub">Current Stock</div>'+
        '<div class="big-num">'+fmtNum(p.stock||0)+'</div>'+
        '<div class="sub">'+esc(p.uom)+'s</div>'+
      '</div>'+
      '<div style="margin:12px 0 8px;font-weight:700;font-size:14px;color:var(--gy);text-transform:uppercase">Operation</div>'+
      '<div class="qty-toggle" id="stkOpTog" style="margin-bottom:12px">'+
        '<div class="qty-opt on" onclick="stkOp(\'add\')">&#10010; Add</div>'+
        '<div class="qty-opt" onclick="stkOp(\'sub\')">&#8722; Remove</div>'+
        '<div class="qty-opt" onclick="stkOp(\'set\')">&#8801; Set Total</div>'+
      '</div>'+
      '<div id="stkInputArea">'+
        '<div class="grid2">'+
          '<div class="fg"><label class="lbl">No. of Cases '+qpcInfo+'</label><input class="inp" type="number" min="0" step="0.5" id="stk-cases" placeholder="e.g. 3" oninput="stkCalc()"></div>'+
          '<div class="fg"><label class="lbl">Loose Pcs ('+esc(p.uom)+'s)</label><input class="inp" type="number" min="0" id="stk-loose" placeholder="e.g. 5" oninput="stkCalc()"></div>'+
        '</div>'+
        '<div class="fg"><label class="lbl">Total Units = (Cases &times; Qty/Case) + Loose</label><input class="inp inp-ro" id="stk-total-calc" readonly style="font-weight:800;color:var(--r1)"></div>'+
      '</div>'+
      '<div id="stkResultPrev"></div>'+
    '</div>'+
    '<div class="modal-ftr">'+
      '<button class="btn btn-gh" onclick="closeModal()">Cancel</button>'+
      '<button class="btn btn-r btn-lg" onclick="applyStk(\''+id+'\')">&#9989; Update Stock</button>'+
    '</div></div>');
  stkCalc();
}

window.stkOp=function(op){
  window._stkOp=op;
  document.querySelectorAll('#stkOpTog .qty-opt').forEach(function(e,i){e.classList.toggle('on',['add','sub','set'][i]===op);});
  stkCalc();
};

window.stkCalc=function(){
  var p=window._stkProd;if(!p)return;
  var cur=p.stock||0;var op=window._stkOp||'add';
  var qpc=p.qtyPerCase||1;
  var cases=parseFloat((document.getElementById('stk-cases')||{}).value)||0;
  var loose=parseFloat((document.getElementById('stk-loose')||{}).value)||0;
  var inputQty=(cases*qpc)+loose;
  var cqEl=document.getElementById('stk-total-calc');if(cqEl)cqEl.value=inputQty||'0';

  var ns=op==='set'?inputQty:op==='add'?cur+inputQty:Math.max(0,cur-inputQty);
  var diff=ns-cur;
  var prevEl=document.getElementById('stkResultPrev');
  var liveEl=document.getElementById('stkLivePrev');
  if(liveEl){
    liveEl.innerHTML='<div class="sub">New Stock After Update</div><div class="big-num" style="color:'+(ns>cur?'var(--green-text)':ns<cur?'var(--red-text)':'var(--blue-text)')+'">'+fmtNum(ns)+'</div><div class="sub">'+esc(p.uom)+'s'+(diff!==0?' ('+(diff>0?'+':'')+diff+')':'')+'</div>';
  }
  if(prevEl){
    if(inputQty>0||op==='set'){
      prevEl.innerHTML='<div class="alert alert-info" style="margin-top:8px">'+
        (op==='set'?'Setting total to ':'Changing by '+(diff>=0?'+':'')+diff+' units — ')+
        'New total: <strong>'+fmtNum(ns)+' '+esc(p.uom)+'s</strong></div>';
    }else{prevEl.innerHTML='';}
  }
};
window.applyStk=function(id){
  var idx=products.findIndex(function(x){return x._id===id;});if(idx<0)return;
  var p=products[idx];var cur=p.stock||0;var op=window._stkOp||'add';
  var qpc=p.qtyPerCase||1;
  var cases=parseFloat((document.getElementById('stk-cases')||{}).value)||0;
  var loose=parseFloat((document.getElementById('stk-loose')||{}).value)||0;
  var inputQty=(cases*qpc)+loose;

  var ns=op==='set'?inputQty:op==='add'?cur+inputQty:Math.max(0,cur-inputQty);
  var newCases=Math.floor(ns/qpc);
  var newLoose=ns%qpc;
  products[idx]=Object.assign({},products[idx],{stock:ns,stockCases:newCases,stockLoose:newLoose});
  
  toast('Updating stock...','info');
  apiCall('updateStock',{products:[products[idx]]},function(res){
    if(res.status==='success'){
      toast('Stock updated!');
      closeModal();
      gdPullFromScript();
    }else{
      toast('Sync failed: '+res.message,'err');
    }
  });
};

function delProd(id){
  if(!confirm('Delete this product?'))return;
  toast('Deleting product...','info');
  apiCall('deleteProduct',{productId:id},function(res){
    if(res.status==='success'){
      toast('Product deleted!');
      gdPullFromScript();
    }else{
      toast('Failed to delete product: '+res.message,'err');
    }
  });
}

function showEditModal(id){
  var p=products.find(function(x){return x._id===id;});if(!p)return;
  var priceRows=REF_LIST.map(function(r){
    return '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'+
      '<span style="font-size:13px;color:var(--gy);min-width:100px">#'+r.id+' '+esc(r.name.slice(0,12))+'</span>'+
      '<input class="inp" type="number" style="flex:1;padding:6px 8px;font-size:15px" id="pr_'+r.id+'" value="'+(p.prices&&p.prices[r.id]!=null?p.prices[r.id]:'')+'" placeholder="—">'+
    '</div>';
  }).join('');
  var uomOpts=['BOX','PKT','TIN','ROLL','PCS'].map(function(u){return '<option'+(p.uom===u?' selected':'')+'>'+u+'</option>';}).join('');
  var qpc=p.qtyPerCase||1;
  var curCases=p.stockCases!=null?p.stockCases:Math.floor((p.stock||0)/qpc);
  var curLoose=p.stockLoose!=null?p.stockLoose:((p.stock||0)%qpc);

  showModal('<div class="modal" style="max-width:560px">'+
    '<div class="modal-hdr"><span class="modal-title">&#9999;&#65039; '+t('editProd')+'</span><button class="modal-x" onclick="closeModal()">&#10005;</button></div>'+
    '<div class="modal-body">'+
      '<div class="fg"><label class="lbl">Name</label><input class="inp" id="ep_name" value="'+esc(p.name)+'"></div>'+
      '<div class="grid2">'+
        '<div class="fg"><label class="lbl">Company (in Name)</label><input class="inp inp-ro" id="ep_co" value="'+esc(p.company||'')+'" readonly style="opacity:0.6" title="Company is part of the product name"></div>'+
        '<div class="fg"><label class="lbl">UOM</label><select class="sel" id="ep_uom">'+uomOpts+'</select></div>'+
        '<div class="fg"><label class="lbl">Qty/Case</label><input class="inp" type="number" id="ep_qpc" value="'+(p.qtyPerCase||'')+'" oninput="calcEditStock()"></div>'+
        '<div class="fg"><label class="lbl">Stock Cases</label><input class="inp" type="number" min="0" step="0.5" id="ep_cases" value="'+curCases+'" oninput="calcEditStock()"></div>'+
        '<div class="fg"><label class="lbl">Loose Pcs (Units)</label><input class="inp" type="number" min="0" id="ep_loose" value="'+curLoose+'" oninput="calcEditStock()"></div>'+
        '<div class="fg"><label class="lbl">Total Stock (auto-calc)</label><input class="inp inp-ro" type="number" id="ep_stk" value="'+(p.stock||0)+'" readonly style="font-weight:800;color:var(--r1)"></div>'+
        '<div class="fg"><label class="lbl">Cost Price</label><input class="inp" type="number" id="ep_cost" value="'+(p.costPrice||'')+'"></div>'+
        '<div class="fg"><label class="lbl">Category</label><input class="inp" id="ep_cat" value="'+esc(p.category||'')+'"></div>'+
      '</div>'+
      '<div style="font-weight:700;font-size:15px;margin-bottom:8px">Selling Prices by Reference</div>'+
      priceRows+
    '</div>'+
    '<div class="modal-ftr"><button class="btn btn-gh" onclick="closeModal()">'+t('cancel')+'</button><button class="btn btn-r" onclick="saveEdit(\''+id+'\')">&#128190; '+t('save')+'</button></div>'+
  '</div>');
}

window.calcEditStock=function(){
  var qpc=parseFloat((document.getElementById('ep_qpc')||{}).value)||1;
  var cases=parseFloat((document.getElementById('ep_cases')||{}).value)||0;
  var loose=parseFloat((document.getElementById('ep_loose')||{}).value)||0;
  var total=(cases*qpc)+loose;
  var stkEl=document.getElementById('ep_stk');
  if(stkEl) stkEl.value=total;
};

window.saveEdit=function(id){
  var idx=products.findIndex(function(p){return p._id===id;});if(idx<0)return;
  var prices={};REF_LIST.forEach(function(r){var v=(document.getElementById('pr_'+r.id)||{}).value;prices[r.id]=v?Number(v):null;});
  var qpc=parseFloat((document.getElementById('ep_qpc')||{}).value)||null;
  var cases=parseFloat((document.getElementById('ep_cases')||{}).value)||0;
  var loose=parseFloat((document.getElementById('ep_loose')||{}).value)||0;
  var totalStk=qpc?((cases*qpc)+loose):(parseFloat((document.getElementById('ep_stk')||{}).value)||0);

  var updatedProd=Object.assign({},products[idx],{
    name:(document.getElementById('ep_name')||{}).value||products[idx].name,
    company:(document.getElementById('ep_co')||{}).value||'',
    uom:(document.getElementById('ep_uom')||{}).value||'BOX',
    qtyPerCase:qpc,
    stockCases:cases,
    stockLoose:loose,
    stock:totalStk,
    costPrice:parseFloat((document.getElementById('ep_cost')||{}).value)||null,
    category:(document.getElementById('ep_cat')||{}).value||'',
    prices:prices
  });
  // Update locally immediately — no waiting for server
  products[idx] = updatedProd;
  saveAll();
  closeModal();
  renderInventory();
  renderStockMgr && renderStockMgr();
  toast('&#9989; Product updated!','ok');

  // Then sync to the cloud in the background
  if(cloudOn()){
    apiCall('updateProduct',{product:updatedProd},function(res){
      if(res.status==='success'){
        toast(res.queued?'No internet - saved on this device, will upload automatically.':'&#9989; Saved to the cloud!',res.queued?'err':'ok');
      }else{
        toast('Local save done. Cloud sync failed: '+res.message,'err');
      }
    });
  }
};

function showAddModal(){
  var uomOpts=['BOX','PKT','TIN','ROLL','PCS'].map(function(u){return '<option>'+u+'</option>';}).join('');
  showModal('<div class="modal">'+
    '<div class="modal-hdr"><span class="modal-title">&#10010; '+t('addProd')+'</span><button class="modal-x" onclick="closeModal()">&#10005;</button></div>'+
    '<div class="modal-body">'+
      '<div class="fg"><label class="lbl">Product Name *</label><input class="inp" id="np_name" placeholder="e.g. CORNATION - DRONE"></div>'+
      '<div class="grid2">'+
        '<div class="fg"><label class="lbl">Company</label><input class="inp" id="np_co"></div>'+
        '<div class="fg"><label class="lbl">UOM</label><select class="sel" id="np_uom">'+uomOpts+'</select></div>'+
        '<div class="fg"><label class="lbl">Qty/Case</label><input class="inp" type="number" id="np_qpc" placeholder="e.g. 60" oninput="calcAddStock()"></div>'+
        '<div class="fg"><label class="lbl">Opening Cases</label><input class="inp" type="number" min="0" step="0.5" id="np_cases" value="0" oninput="calcAddStock()"></div>'+
        '<div class="fg"><label class="lbl">Opening Loose Pcs</label><input class="inp" type="number" min="0" id="np_loose" value="0" oninput="calcAddStock()"></div>'+
        '<div class="fg"><label class="lbl">Total Opening Stock</label><input class="inp inp-ro" type="number" id="np_stk" value="0" readonly style="font-weight:800;color:var(--r1)"></div>'+
        '<div class="fg"><label class="lbl">Cost Price</label><input class="inp" type="number" id="np_cost"></div>'+
        '<div class="fg"><label class="lbl">Category</label><input class="inp" id="np_cat"></div>'+
      '</div>'+
    '</div>'+
    '<div class="modal-ftr"><button class="btn btn-gh" onclick="closeModal()">'+t('cancel')+'</button><button class="btn btn-r" onclick="saveAdd()">&#10010; Add</button></div>'+
  '</div>');
}

window.calcAddStock=function(){
  var qpc=parseFloat((document.getElementById('np_qpc')||{}).value)||1;
  var cases=parseFloat((document.getElementById('np_cases')||{}).value)||0;
  var loose=parseFloat((document.getElementById('np_loose')||{}).value)||0;
  var total=(cases*qpc)+loose;
  var stkEl=document.getElementById('np_stk');
  if(stkEl) stkEl.value=total;
};

window.saveAdd=function(){
  var nm=(document.getElementById('np_name')||{}).value||'';
  if(!nm.trim()){toast('Name required!','err');return;}
  var qpc=parseFloat((document.getElementById('np_qpc')||{}).value)||null;
  var cases=parseFloat((document.getElementById('np_cases')||{}).value)||0;
  var loose=parseFloat((document.getElementById('np_loose')||{}).value)||0;
  var totalStk=qpc?((cases*qpc)+loose):(parseFloat((document.getElementById('np_stk')||{}).value)||0);

  var newProd={
    name:nm.trim(),
    company:(document.getElementById('np_co')||{}).value||'',
    uom:(document.getElementById('np_uom')||{}).value||'BOX',
    qtyPerCase:parseFloat((document.getElementById('np_qpc')||{}).value)||null,
    stock:parseFloat((document.getElementById('np_stk')||{}).value)||0,
    costPrice:parseFloat((document.getElementById('np_cost')||{}).value)||null,
    category:(document.getElementById('np_cat')||{}).value||'',
    prices:{}
  };
  toast('Adding product...','info');
  apiCall('addProduct',{product:newProd},function(res){
    if(res.status==='success'){
      toast('Product added successfully!');
      closeModal();
      gdPullFromScript();
    }else{
      toast('Failed to add product: '+res.message,'err');
    }
  });
};

// == HISTORY ==
function renderHistoryList(){
  var el=document.getElementById('hist-results');if(!el)return;
  var list=bills.slice();
  list.sort(function(a, b) {
    var tA = a.date ? new Date(a.date).getTime() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
    var tB = b.date ? new Date(b.date).getTime() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
    return tB - tA;
  });
  if(histSearch){var q=histSearch.toLowerCase();list=list.filter(function(b){
    return b.customerName.toLowerCase().indexOf(q)>=0||String(b.billNumber).indexOf(histSearch)>=0||(b.referenceName||'').toLowerCase().indexOf(q)>=0;
  });}
  var cards=list.map(function(b){
    var verBadge=(b.version||1)>1?'<span class="version-badge">v'+(b.version||1)+'</span>':'';
    var parentBadge=b.parentBillId?'<span class="tag tag-b" style="font-size:12px">Edited</span>':'';
    var pendingItems=(b.items||[]).filter(function(it){return (it.qtyPending||0)>0;});
    var pendingBadge=pendingItems.length?'<span class="tag" style="background:rgba(245,158,11,0.16);color:#fbbf24;font-size:12px">&#9888; '+pendingItems.length+' pending</span>':'';
    var lockInfo=billLocks[b._id];
    var lockBadge=lockInfo?'<span class="tag tag-r" style="font-size:12px">&#128274; Editing: '+esc(lockInfo.username||'someone')+'</span>':'';
    var editBtn=userRole==='admin'
      ? (lockInfo
          ? '<button class="btn btn-gh btn-sm" disabled title="Locked — being edited by '+esc(lockInfo.username||'someone')+' on another device">&#128274; Locked</button>'
          : '<button class="btn btn-o btn-sm" onclick="editBill(\''+b._id+'\');">&#9999; Edit</button>')
      : '';
    return '<div class="card" style="padding:12px;margin-bottom:10px">'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">'+
        '<div>'+
          '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;flex-wrap:wrap">'+
            '<span class="tag tag-r">#'+esc(b.billNumber)+'</span>'+verBadge+parentBadge+pendingBadge+lockBadge+
            '<span style="font-size:14px;color:var(--gy)">'+esc(b.displayDate||'')+'</span>'+
          '</div>'+
          '<div style="font-weight:700;font-size:17px">'+esc(b.customerName)+'</div>'+
          '<div style="font-size:14px;color:var(--gy);margin-top:2px">'+(b.items?b.items.length:0)+' items &middot; Cases: '+(b.totalCases||0)+'</div>'+
        '</div>'+
        '<div style="text-align:right">'+
          '<div style="font-weight:800;font-size:21px;color:var(--red-text)">'+fmtMoney(b.totalAmount)+'</div>'+
          '<div class="btn-row" style="margin-top:6px;justify-content:flex-end">'+
            '<button class="btn btn-gh btn-sm" onclick="showBillPreview(bills.find(function(x){return x._id===\''+b._id+'\';}))">&#128065; View</button>'+
            editBtn+
            '<button class="btn btn-b btn-sm" onclick="printBill(\''+b._id+'\');">&#128424; Print</button>'+
            '<button class="btn btn-r btn-sm" onclick="downloadBill(\''+b._id+'\');">&#8681; PDF</button>'+
            '<button class="btn btn-sm" style="background:#25D366;color:#fff" onclick="shareBillWhatsApp(\''+b._id+'\');">&#128241; WhatsApp</button>'+
            (userRole==='admin'?'<button class="btn btn-del btn-sm" onclick="delBill(\''+b._id+'\');">&#128465;&#65039;</button>':'')+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');
  el.innerHTML=list.length?cards:'<div class="empty"><div class="empty-ico">&#128203;</div><div class="empty-txt">No estimates found</div></div>';
}

function renderHistory(){
  var el=document.getElementById('pg-history');
  el.innerHTML=
    '<div class="sec-hdr"><h2 class="sec-title">&#128203; '+t('history')+'</h2><span class="tag tag-gy">'+bills.length+' bills</span></div>'+
    '<div class="card" style="margin-bottom:12px"><div class="srch-wrap"><span class="srch-ico">&#128269;</span>'+
    '<input class="srch-inp" id="hist-srch" value="'+esc(histSearch)+'" placeholder="Search customer, estimate no..."></div></div>'+
    '<div id="hist-results"></div>';
  renderHistoryList();
  apiFetchBillLocks(function(){ renderHistoryList(); });
  var _t=null;
  document.getElementById('hist-srch').addEventListener('input',function(e){
    histSearch=e.target.value;
    clearTimeout(_t);_t=setTimeout(renderHistoryList,150);
  });
}
function delBill(id){
  if(!confirm('Delete this estimate?'))return;
  bills=bills.filter(function(b){return b._id!==id;});saveAll();toast('Estimate deleted');renderHistory();
}

// == SETTINGS ==
function renderSettings(){
  var el=document.getElementById('pg-settings');
  var tabBtns=[['general','General'],['stock','&#128230; Stock'],['data','Data & Sync'],['users','Users']].map(function(x){
    return '<button class="btn '+(settingsTab===x[0]?'btn-r':'btn-gh')+'" onclick="setStab(\''+x[0]+'\')">'+x[1]+'</button>';
  }).join('');
  el.innerHTML='<h2 class="sec-title" style="margin-bottom:13px">&#9881;&#65039; '+t('settings')+'</h2>'+
    '<div style="display:flex;gap:8px;margin-bottom:14px;border-bottom:2px solid var(--card-border);padding-bottom:8px;flex-wrap:wrap">'+tabBtns+'</div>'+
    '<div id="stab-body"></div>';
  renderStab();
}

function setStab(k){settingsTab=k;renderStab();}

function setPriceLookupRef(slot, val){
  priceLookupRefs[slot]=val;
  updatePriceLookupResults();
}

function buildPriceLookupResults(){
  var cols=priceLookupRefs.filter(function(r){return r && (r!=='cost'||userRole==='admin');});
  var q=(priceLookupSearch||'').trim().toLowerCase();
  if(!cols.length){
    return '<div class="empty" style="padding:20px"><div class="empty-txt">Pick at least one reference'+(userRole==='admin'?' (or Cost Price)':'')+' above to see values.</div></div>';
  }
  var list=products.filter(function(p){return !q||(p.name||'').toLowerCase().indexOf(q)>=0||(p.company||'').toLowerCase().indexOf(q)>=0||(p.category||'').toLowerCase().indexOf(q)>=0||(p.uom||'').toLowerCase().indexOf(q)>=0;});
  if(!list.length){
    return '<div class="empty" style="padding:20px"><div class="empty-txt">No items match "'+esc(priceLookupSearch)+'"</div></div>';
  }
  list=list.slice(0,100); // cap render for performance
  var colHeaders=cols.map(function(cid){
    if(cid==='cost') return '<th style="background:rgba(245,158,11,0.16);color:#fbbf24">Cost Price</th>';
    var rname=REF_MAP[cid]||('Ref '+cid);
    return '<th>#'+esc(cid)+' &middot; '+esc(rname)+'</th>';
  }).join('');
  var rows=list.map(function(p){
    var cells=cols.map(function(cid){
      var v=cid==='cost'?(p.costPrice!=null?Number(p.costPrice):null):getPrice(p,cid);
      var style=cid==='cost'?' style="background:rgba(245,158,11,0.06)"':'';
      return '<td class="num"'+style+'>'+(v!=null?'&#8377;'+v:'<span style="color:var(--text-muted)">—</span>')+'</td>';
    }).join('');
    var st=(p.stock||0);
    return '<tr><td style="font-weight:700;font-size:14px">'+esc(p.name)+'</td>'+
      '<td class="'+stockClass(st)+'" style="text-align:center;font-weight:700">'+fmtNum(st)+'</td>'+cells+'</tr>';
  }).join('');
  var moreNote=products.filter(function(p){return !q||(p.name||'').toLowerCase().indexOf(q)>=0||(p.company||'').toLowerCase().indexOf(q)>=0||(p.category||'').toLowerCase().indexOf(q)>=0||(p.uom||'').toLowerCase().indexOf(q)>=0;}).length>100
    ?'<div style="font-size:13.5px;color:var(--text-muted);margin-top:6px">Showing first 100 matches — refine your search for more precise results.</div>':'';
  return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Item</th><th>Stock</th>'+colHeaders+'</tr></thead><tbody>'+rows+'</tbody></table></div>'+moreNote;
}

function updatePriceLookupResults(){
  var w=document.getElementById('pl-results');
  if(w) w.innerHTML=buildPriceLookupResults();
  // Keep the ref dropdowns in sync with current selection after a re-render
  [0,1,2].forEach(function(i){
    var sel=document.getElementById('pl-ref-'+i);
    if(sel) sel.value=priceLookupRefs[i]||'';
  });
}

function renderPriceLookup(){
  var el=document.getElementById('pg-pricelookup');
  var refOptsBlank='<option value="">— None —</option>';
  var refOpts=refOptsBlank+(userRole==='admin'?'<option value="cost">&#128176; Cost Price</option>':'')+REF_LIST.map(function(r){return '<option value="'+r.id+'">#'+r.id+' &middot; '+esc(r.name)+'</option>';}).join('');
  if(priceLookupRefs.every(function(r){return !r;}) && REF_LIST.length){
    priceLookupRefs=[REF_LIST[0].id, REF_LIST[1]?REF_LIST[1].id:'', REF_LIST[2]?REF_LIST[2].id:''];
  }
  var refSelects=[0,1,2].map(function(i){
    return '<div class="fg"><label class="lbl">Reference '+(i+1)+'</label>'+
      '<select class="inp" id="pl-ref-'+i+'" onchange="setPriceLookupRef('+i+',this.value)">'+refOpts+'</select></div>';
  }).join('');
  el.innerHTML=
    '<h2 class="sec-title" style="margin-bottom:13px">&#128269; '+t('priceLookupNav')+'</h2>'+
    '<div class="card"><div class="card-title">Compare up to 3 References</div>'+
      '<div class="grid2" style="grid-template-columns:repeat(3,1fr)">'+refSelects+'</div>'+
      '<div class="fg" style="margin-top:6px"><div class="srch-wrap"><span class="srch-ico">&#128269;</span>'+
      '<input class="srch-inp" id="pl-search" value="'+esc(priceLookupSearch)+'" placeholder="Search item name..." autocomplete="off"></div></div>'+
      '<div id="pl-results" style="margin-top:10px">'+buildPriceLookupResults()+'</div>'+
    '</div>';
  [0,1,2].forEach(function(i){
    var sel=document.getElementById('pl-ref-'+i);
    if(sel) sel.value=priceLookupRefs[i]||'';
  });
  var s=document.getElementById('pl-search');
  if(s){
    s.addEventListener('input',function(e){
      priceLookupSearch=e.target.value;
      updatePriceLookupResults();
    });
  }
}

function renderCustomersPage(){
  var el=document.getElementById('pg-customers');
  var isAdmin=userRole==='admin';
  var refOpts=REF_LIST.map(function(r){return '<option value="'+r.id+'">#'+r.id+' — '+esc(r.name)+'</option>';}).join('');
  var custCards=customers.map(function(c){
    var idAttr=esc(String(c._id||''));
    var extraLine=[c.aadhar?'Aadhar: '+esc(c.aadhar):'',c.gst?'GST: '+esc(c.gst):'',c.contact2?'Alt: '+esc(c.contact2):''].filter(function(x){return x;}).join(' &middot; ');
    return '<div style="background:var(--card-bg);border:1px solid var(--card-border);border-radius:12px;padding:12px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">'+
      '<div><div style="font-weight:700">'+esc(c.name)+'</div>'+
      '<div style="font-size:14px;color:var(--text-muted);margin-top:3px">'+esc(c.address||'')+(c.contact?' &middot; '+esc(c.contact):'')+'</div>'+
      (extraLine?'<div style="font-size:13px;color:var(--text-muted);margin-top:2px">'+extraLine+'</div>':'')+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'+
        (c.defaultRef?'<span class="tag tag-r">Ref #'+c.defaultRef+'</span>':'')+
        (isAdmin?'<button class="btn btn-b btn-sm" onclick="showCustomerSummary(\''+idAttr+'\')">&#128202; Summary</button>':'')+
        '<button class="btn btn-gh btn-sm" onclick="editCustomer(\''+idAttr+'\')">&#9999; Edit</button>'+
      '</div>'+
    '</div>';
  }).join('');
  el.innerHTML=
    '<h2 class="sec-title" style="margin-bottom:13px">&#128101; '+t('customersNav')+'</h2>'+
    '<div class="card"><div class="card-title">&#10010; Add New Customer</div>'+
      '<div class="grid2">'+
        '<div class="fg"><label class="lbl">Name *</label><input class="inp" id="nc_name" placeholder="Customer name"></div>'+
        '<div class="fg"><label class="lbl">Contact 1</label><input class="inp" id="nc_ph" placeholder="Phone"></div>'+
        '<div class="fg"><label class="lbl">Contact 2</label><input class="inp" id="nc_ph2" placeholder="Alternate phone"></div>'+
        '<div class="fg"><label class="lbl">Address</label><input class="inp" id="nc_addr" placeholder="Village / Address"></div>'+
        '<div class="fg"><label class="lbl">Aadhar Number</label><input class="inp" id="nc_aadhar" placeholder="XXXX XXXX XXXX"></div>'+
        '<div class="fg"><label class="lbl">GST Number</label><input class="inp" id="nc_gst" placeholder="GSTIN"></div>'+
        '<div class="fg"><label class="lbl">Default Ref #</label><select class="sel" id="nc_ref" onchange="toggleNewRefFields(this.value)"><option value="">— Select —</option>'+refOpts+'<option value="__new__">&#10010; Create New Reference...</option></select></div>'+
      '</div>'+
      '<div id="nc-new-ref-fields" style="display:none;margin-top:10px;padding:12px;background:var(--btn-sec-bg);border-radius:10px;border:1px dashed var(--card-border)">'+
        '<div class="grid2">'+
          '<div class="fg"><label class="lbl">New Reference Name</label><input class="inp" id="nc_new_ref_name" placeholder="e.g. this customer\'s name"></div>'+
          '<div class="fg"><label class="lbl">Copy Prices From</label><select class="inp" id="nc_new_ref_base">'+refOpts+'</select></div>'+
        '</div>'+
        '<div style="font-size:13px;color:var(--text-muted)">Every product\'s price for the selected reference is copied into the new one — this new reference becomes the customer\'s default, and you can edit individual prices afterward.</div>'+
      '</div>'+
      '<button class="btn btn-r" style="margin-top:10px" onclick="addCust()">&#10010; Add Customer</button>'+
    '</div>'+
    '<div class="card"><div class="card-title">&#128101; All Customers ('+customers.length+')</div>'+custCards+'</div>';
}

var pendingLoadsSearch='';

// Aggregates every bill's pending (unloaded) item quantities, both per
// customer and as a grand total per item. Source of truth is the same
// qtyPending already tracked on each bill item — no separate state needed.
function buildPendingLoadsData(){
  var byCustomer={}; // customerName -> { total, items: { productName: {qty, uom} } }
  var byItem={};      // productName -> { qty, uom }
  bills.forEach(function(b){
    (b.items||[]).forEach(function(item){
      var pending=item.qtyPending!=null?Number(item.qtyPending):0;
      if(!pending||pending<=0)return;
      var cust=b.customerName||'Unknown';
      if(!byCustomer[cust])byCustomer[cust]={total:0,items:{}};
      if(!byCustomer[cust].items[item.productName])byCustomer[cust].items[item.productName]={qty:0,uom:item.uom||''};
      byCustomer[cust].items[item.productName].qty+=pending;
      byCustomer[cust].total+=pending;

      if(!byItem[item.productName])byItem[item.productName]={qty:0,uom:item.uom||''};
      byItem[item.productName].qty+=pending;
    });
  });
  return {byCustomer:byCustomer,byItem:byItem};
}

function buildPendingCustCardsHtml(names,data){
  if(!names.length)return '<div class="empty" style="padding:16px"><div class="empty-txt">No customers match "'+esc(pendingLoadsSearch)+'"</div></div>';
  return names.map(function(cn){
    var c=data.byCustomer[cn];
    var itemRows=Object.keys(c.items).sort().map(function(pname){
      var it=c.items[pname];
      return '<tr><td style="font-weight:600;font-size:14px">'+esc(pname)+'</td><td class="num" style="font-weight:700;color:var(--red-text)">'+fmtNum(it.qty)+' '+esc(it.uom)+'</td></tr>';
    }).join('');
    return '<div class="card" style="margin-bottom:10px">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px">'+
        '<div class="card-title" style="margin-bottom:0">&#128100; '+esc(cn)+'</div>'+
        '<div style="display:flex;align-items:center;gap:6px">'+
          '<span class="tag tag-r">'+fmtNum(c.total)+' pending</span>'+
          '<button class="btn btn-b btn-sm" onclick="showPendingLoadsCustomerDetail(\''+esc(cn).replace(/'/g,"\\'")+'\')">&#128202; View / Print / Share</button>'+
        '</div>'+
      '</div>'+
      '<div class="tbl-wrap"><table class="tbl"><tbody>'+itemRows+'</tbody></table></div>'+
    '</div>';
  }).join('');
}

// Per-bill, dated breakdown of one customer's pending items — used by the
// detail modal, print view, and WhatsApp-shared PDF.
function buildPendingLoadsByBillForCustomer(customerName){
  var rows=[];
  var grandTotal=0;
  bills.filter(function(b){return (b.customerName||'')===customerName;}).forEach(function(b){
    var items=[];
    var billTotal=0;
    (b.items||[]).forEach(function(item){
      var pending=item.qtyPending!=null?Number(item.qtyPending):0;
      if(pending>0){
        items.push({name:item.productName,qty:pending,uom:item.uom||''});
        billTotal+=pending;
      }
    });
    if(items.length){
      rows.push({date:b.date,displayDate:b.displayDate||fmtDateDMY(b.date),billNumber:b.billNumber,items:items,billTotal:billTotal});
      grandTotal+=billTotal;
    }
  });
  rows.sort(function(a,b){return new Date(a.date)-new Date(b.date);});
  return {rows:rows,grandTotal:grandTotal};
}

function buildPendingLoadsCustomerHTML(customerName,data){
  var rows=data.rows.map(function(r){
    var itemsList=r.items.map(function(it){return esc(it.name)+' — <strong>'+fmtNum(it.qty)+' '+esc(it.uom)+'</strong>';}).join('<br>');
    return '<tr><td>'+r.displayDate+'</td><td><strong>#'+esc(r.billNumber)+'</strong></td>'+
      '<td>'+itemsList+'</td>'+
      '<td style="text-align:right;font-weight:800;color:#dc2626">'+fmtNum(r.billTotal)+'</td></tr>';
  }).join('');
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;padding:20px;color:#000}.hdr{background:#374151;color:#fff;padding:14px;text-align:center;border-radius:8px 8px 0 0;margin-bottom:10px}.hdr h1{font-size:19px}.meta{background:#f3f4f6;border:1px solid #d1d5db;padding:8px;border-radius:6px;margin-bottom:12px}.meta label{display:block;font-size:9px;font-weight:700;color:#374151;text-transform:uppercase}.meta span{font-size:13px;font-weight:700}table{width:100%;border-collapse:collapse;margin-top:6px}th{background:#374151;color:#fff;padding:7px 6px;text-align:left;font-size:11px}td{padding:6px;border-bottom:1px solid #f3f4f6;font-size:11px;vertical-align:top}.tot{margin-top:10px;text-align:right;font-size:15px;font-weight:800;color:#dc2626}@media print{body{padding:0}}</style></head><body>'+
    '<div class="hdr"><h1>Pending Loads Statement</h1></div>'+
    '<div class="meta"><label>Customer</label><span>'+esc(customerName)+'</span></div>'+
    '<table><thead><tr><th>Date</th><th>Estimate #</th><th>Items Pending</th><th style="text-align:right">Bill Total</th></tr></thead><tbody>'+rows+'</tbody></table>'+
    '<div class="tot">Grand Total Pending: '+fmtNum(data.grandTotal)+' units</div>'+
    '</body></html>';
}

window.showPendingLoadsCustomerDetail=function(customerName){
  var data=buildPendingLoadsByBillForCustomer(customerName);
  var rows=data.rows.map(function(r){
    var itemsList=r.items.map(function(it){return esc(it.name)+' — <strong>'+fmtNum(it.qty)+' '+esc(it.uom)+'</strong>';}).join('<br>');
    return '<tr><td style="font-size:11.5px">'+r.displayDate+'</td><td style="font-size:12px;font-weight:700">#'+esc(r.billNumber)+'</td>'+
      '<td style="font-size:11.5px">'+itemsList+'</td>'+
      '<td class="num" style="font-weight:800;color:#dc2626">'+fmtNum(r.billTotal)+'</td></tr>';
  }).join('');
  showModal(
    '<div class="modal" style="max-width:600px">'+
    '<div class="modal-hdr"><span class="modal-title">&#9203; '+esc(customerName)+' — Pending Loads</span><button class="modal-x" onclick="closeModal()">&#10005;</button></div>'+
    '<div class="modal-body">'+
      (data.rows.length?'<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Estimate #</th><th>Items Pending</th><th style="text-align:right">Bill Total</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
        '<div style="text-align:right;margin-top:10px;font-weight:800;font-size:15px;color:#dc2626">Grand Total Pending: '+fmtNum(data.grandTotal)+' units</div>'
        :'<div class="empty" style="padding:16px"><div class="empty-txt">Nothing pending for this customer.</div></div>')+
    '</div>'+
    '<div class="modal-ftr">'+
      '<button class="btn btn-gh" onclick="closeModal()">Close</button>'+
      '<button class="btn btn-b" onclick="printPendingLoadsCustomer(\''+esc(customerName).replace(/'/g,"\\'")+'\')">&#128424; Print</button>'+
      '<button class="btn" style="background:#25D366;color:#fff" onclick="sharePendingLoadsCustomerWhatsApp(\''+esc(customerName).replace(/'/g,"\\'")+'\')">&#128241; Share via WhatsApp</button>'+
    '</div></div>'
  );
};

function printPendingLoadsCustomer(customerName){
  var data=buildPendingLoadsByBillForCustomer(customerName);
  var w=window.open('','_blank','width=900,height=700');
  w.document.write(buildPendingLoadsCustomerHTML(customerName,data));
  w.document.close();
  setTimeout(function(){w.print();},500);
}

function sharePendingLoadsCustomerWhatsApp(customerName){
  var data=buildPendingLoadsByBillForCustomer(customerName);
  var htmlContent=buildPendingLoadsCustomerHTML(customerName,data);
  toast('Generating pending loads PDF...','info');
  apiCall('saveCustomerStatement',{customerName:customerName,htmlContent:htmlContent},function(res){
    if(res && res.status==='success' && res.fileUrl){
      var msg='Pending Loads — '+customerName+'\n'+
        'Grand Total Pending: '+fmtNum(data.grandTotal)+' units\n\n'+
        'View / Download PDF:\n'+res.fileUrl;
      window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
    }else{
      toast('Failed to generate PDF: '+(res&&res.message?res.message:'unknown error'),'err');
    }
  });
}

function renderPendingLoads(){
  var el=document.getElementById('pg-pendingloads');
  var data=buildPendingLoadsData();
  var custNames=Object.keys(data.byCustomer).sort();

  if(!custNames.length){
    el.innerHTML='<h2 class="sec-title" style="margin-bottom:13px">&#9203; Pending Loads</h2>'+
      '<div class="empty" style="padding:24px"><div class="empty-ico">&#9989;</div><div class="empty-txt">Nothing pending — every bill is fully loaded.</div></div>';
    return;
  }

  var q=(pendingLoadsSearch||'').trim().toLowerCase();
  // Search by customer name OR by product name inside their pending items
  var filteredNames=custNames.filter(function(cn){
    if(!q) return true;
    if(cn.toLowerCase().indexOf(q)>=0) return true;
    // Also match if any pending item name contains the query
    var custData=data.byCustomer[cn];
    if(custData && custData.items){
      return Object.keys(custData.items).some(function(pname){
        return pname.toLowerCase().indexOf(q)>=0;
      });
    }
    return false;
  });

  var grandTotal=0;
  Object.keys(data.byItem).forEach(function(k){grandTotal+=data.byItem[k].qty;});
  var itemTotalRows=Object.keys(data.byItem).sort().map(function(pname){
    var it=data.byItem[pname];
    return '<tr><td style="font-weight:600;font-size:14px">'+esc(pname)+'</td><td class="num" style="font-weight:800;color:var(--red-text)">'+fmtNum(it.qty)+' '+esc(it.uom)+'</td></tr>';
  }).join('');

  el.innerHTML=
    '<h2 class="sec-title" style="margin-bottom:13px">&#9203; Pending Loads</h2>'+
    '<div class="fg" style="margin-bottom:12px"><div class="srch-wrap"><span class="srch-ico">&#128269;</span>'+
    '<input class="srch-inp" id="pl-loads-search" value="'+esc(pendingLoadsSearch)+'" placeholder="Search customer or product..." autocomplete="off"></div></div>'+
    '<div id="pl-loads-cust-list">'+buildPendingCustCardsHtml(filteredNames,data)+'</div>'+
    '<div class="card"><div class="card-title">&#128202; Total Pending by Item ('+fmtNum(grandTotal)+' units across '+custNames.length+' customers)</div>'+
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Item</th><th style="text-align:right">Total Pending</th></tr></thead><tbody>'+itemTotalRows+'</tbody></table></div></div>';

  var s=document.getElementById('pl-loads-search');
  if(s){
    s.addEventListener('input',function(e){
      pendingLoadsSearch=e.target.value;
      var w=document.getElementById('pl-loads-cust-list');
      if(w){
        var qq=pendingLoadsSearch.trim().toLowerCase();
        var fn=custNames.filter(function(cn){
          if(!qq) return true;
          if(cn.toLowerCase().indexOf(qq)>=0) return true;
          var custData=data.byCustomer[cn];
          if(custData && custData.items){
            return Object.keys(custData.items).some(function(pname){
              return pname.toLowerCase().indexOf(qq)>=0;
            });
          }
          return false;
        });
        w.innerHTML=buildPendingCustCardsHtml(fn,data);
      }
    });
  }
}

function renderStab(){
  var el=document.getElementById('stab-body');if(!el)return;
  if(settingsTab==='stock'){renderStockMgr();return;}
  if(settingsTab==='general'){
    var refHtml=REF_LIST.map(function(r){
      return '<div style="background:var(--btn-sec-bg);border:1px solid var(--card-border);border-radius:12px;padding:12px">'+
        '<span class="tag tag-r">#'+r.id+'</span>'+
        '<div style="font-weight:700;font-size:15px;margin-top:6px">'+esc(r.name)+'</div></div>';
    }).join('');
    var bulkCostHtml=userRole==='admin'?
      '<div class="card"><div class="card-title">&#128176; Cost Price (temporary)</div>'+
        '<p style="font-size:14px;color:var(--text-muted);margin-bottom:10px">There\'s no Cost Price column in the sheet yet, so individual edits don\'t sync. Use this to set a placeholder value for every product until that\'s set up.</p>'+
        '<button class="btn btn-o" onclick="bulkSetCostPrice()">Set &#8377;10 for All Products</button>'+
      '</div>':'';
    var infoHtml=[['Products',products.length],['Customers',customers.length],['Estimates',bills.length],['Active Role',userRole.toUpperCase()]].map(function(x){
      return '<div style="background:var(--btn-sec-bg);border-radius:12px;border:1px solid var(--card-border);padding:12px"><div style="font-size:13px;color:var(--text-muted)">'+x[0]+'</div><div style="font-weight:800;font-size:20px;margin-top:4px">'+x[1]+'</div></div>';
    }).join('');
    el.innerHTML=
      '<div class="card"><div class="card-title">&#127760; Language / బాష</div>'+
        '<div class="btn-row">'+
          '<button class="btn btn-lg '+(lang==='en'?'btn-r':'btn-gh')+'" onclick="setLang(\'en\')">&#127468;&#127463; English</button>'+
          '<button class="btn btn-lg '+(lang==='te'?'btn-r':'btn-gh')+'" onclick="setLang(\'te\')">&#127470;&#127475; తెలుగు</button>'+
        '</div></div>'+
      '<div class="card"><div class="card-title">&#128290; Reference Numbers ('+REF_LIST.length+')</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px">'+refHtml+'</div></div>'+
      bulkCostHtml+
      '<div class="card"><div class="card-title">&#8505;&#65039; System Info</div><div class="grid2">'+infoHtml+'</div></div>';
  }else if(settingsTab==='data'){
    el.innerHTML=
      '<div class="card" style="border:2px solid var(--success)">'+
        '<div class="card-title" style="color:var(--success)">&#9729;&#65039; Cloud database (Supabase)</div>'+
        '<p style="font-size:15px;color:var(--text-muted);margin-bottom:14px">Products, prices, customers and estimates are stored in your cloud database and shared by every device. Everything is saved on this device first and uploaded automatically whenever the internet is available.</p>'+
        '<div id="cloud-status-line" style="margin-bottom:14px;font-size:15px">'+cloudStatusHtml()+'</div>'+
        '<div class="btn-row" style="margin-top:14px">'+
          '<button class="btn btn-b" onclick="gdTestScriptConnection()">&#9889; Test Connection</button>'+
          '<button class="btn btn-o" onclick="gdPullFromScript()">&#8681; Pull All Data (Sync)</button>'+
          '<button class="btn btn-r" onclick="gdPushStockToScript()">&#8679; Push Stock to Cloud</button>'+
          '<button class="btn btn-g" onclick="uploadWaitingChanges()">&#8593; Upload waiting changes now</button>'+
          '<button class="btn" style="background:#7c3aed;color:#fff" onclick="gdHardResetProductsFromSheet()">&#128260; Hard Reset Products from Cloud</button>'+
        '</div>'+
        '<div id="gd-script-status" style="margin-top:12px"></div>'+
      '</div>'+
      '<div class="card"><div class="card-title">&#128228; Export Backup</div>'+
        '<p style="font-size:15px;color:var(--text-muted);margin-bottom:12px">Download all data as JSON file.</p>'+
        '<button class="btn btn-g btn-lg" onclick="exportData()">&#8681; Download Backup</button></div>'+
      '<div class="card"><div class="card-title">&#128229; Import Backup</div>'+
        '<p style="font-size:15px;color:var(--text-muted);margin-bottom:10px">Restore from a JSON backup.</p>'+
        '<input type="file" accept=".json" id="imp_file" style="margin-bottom:10px;display:block;font-size:15px">'+
        '<button class="btn btn-b" onclick="importData()">&#128229; Import JSON</button></div>'+
      '<div class="card" style="border:2px solid var(--danger)"><div class="card-title" style="color:var(--danger)">&#9888;&#65039; Danger Zone</div>'+
        '<button class="btn btn-del" onclick="resetAllLocalData()">&#128465; Reset All Data</button></div>';
  }else if(settingsTab==='users'){
    var exampleEmail=GLTCloud.emailFor('siva');   // the exact e-mail to create for the username "siva"
    el.innerHTML=
      '<div class="card"><div class="card-title">&#128101; Staff logins</div>'+
        '<div id="staff-list"><div class="empty-txt" style="padding:12px;color:var(--text-muted)">Loading...</div></div>'+
      '</div>'+
      '<div class="card"><div class="card-title">&#10010; Add a new person</div>'+
        '<div class="alert alert-info" style="display:block;font-size:14px;line-height:1.6">'+
          '1. Open your Supabase project &rarr; <strong>Authentication</strong> &rarr; <strong>Users</strong> &rarr; <strong>Add user</strong> &rarr; <strong>Create new user</strong>.<br>'+
          '2. E-mail: for the username <strong>siva</strong> type exactly <strong>'+esc(exampleEmail)+'</strong> (for another person, replace <strong>siva</strong> with their username), choose a password and tick <strong>Auto Confirm User</strong>.<br>'+
          '3. Come back here and press <strong>Refresh</strong>. The new person appears as an <strong>Employee</strong>; change the role below if needed.<br>'+
          'They log in with just the username (<strong>siva</strong>) and their password.'+
        '</div>'+
        '<button class="btn btn-gh" onclick="loadStaffList()">&#128260; Refresh list</button>'+
      '</div>'+
      '<div class="card"><div class="card-title">&#128274; Change my password</div>'+
        '<div class="grid2">'+
          '<div class="fg"><label class="lbl">New password</label><input class="inp" type="password" id="pw_new" autocomplete="new-password"></div>'+
          '<div class="fg"><label class="lbl">Repeat new password</label><input class="inp" type="password" id="pw_new2" autocomplete="new-password"></div>'+
        '</div>'+
        '<button class="btn btn-r" onclick="changeMyPassword()">&#128190; Change password</button>'+
      '</div>'+
      (userRole==='admin'?
      '<div class="card"><div class="card-title">&#128176; Price-edit password</div>'+
        '<p style="font-size:14px;color:var(--text-muted);margin-bottom:12px">Asked when someone edits a price inside an estimate. Employees can only type it - they can never see it.</p>'+
        '<div class="grid2"><div class="fg"><label class="lbl">New price-edit password</label><input class="inp" type="text" id="pp_new" placeholder="type a new password" autocomplete="off"></div></div>'+
        '<button class="btn btn-r" onclick="changePricePassword()">&#128190; Save password</button>'+
      '</div>':'');
    loadStaffList();
  }
}

// ---- staff management (Settings -> Users) ----
window.loadStaffList=function(){
  var box=document.getElementById('staff-list'); if(!box) return;
  if(!cloudOn()){ box.innerHTML='<div class="alert alert-warn">Log in first.</div>'; return; }
  GLTCloud.listStaff().then(function(list){
    var me=(curUser&&curUser.username)||'';
    box.innerHTML=(list||[]).map(function(u){
      var isMe=u.username===me;
      return '<div style="background:var(--btn-sec-bg);border:1px solid var(--card-border);border-radius:12px;padding:14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap'+(u.active?'':';opacity:.6')+'">'+
        '<div><div style="font-weight:700;font-size:16px">'+esc(u.username)+(isMe?' <span class="tag tag-gy" style="margin-left:6px">you</span>':'')+(u.active?'':' <span class="tag tag-r" style="margin-left:6px">disabled</span>')+'</div>'+
        '<div style="font-size:13px;color:var(--text-muted);margin-top:3px">'+esc(u.email||'')+'</div></div>'+
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'+
          '<select class="sel" style="width:auto;padding:8px 40px 8px 12px" onchange="setStaffRoleUi(\''+esc(u.id)+'\',this.value)">'+
            '<option value="employee"'+(u.role==='employee'?' selected':'')+'>Employee</option>'+
            '<option value="admin"'+(u.role==='admin'?' selected':'')+'>Admin</option></select>'+
          '<button class="btn btn-sm '+(u.active?'btn-del':'btn-g')+'" onclick="setStaffActiveUi(\''+esc(u.id)+'\','+(u.active?'false':'true')+')">'+(u.active?'Disable login':'Enable login')+'</button>'+
        '</div></div>';
    }).join('')||'<div class="empty-txt" style="padding:12px;color:var(--text-muted)">No staff found.</div>';
  }, function(err){
    box.innerHTML='<div class="alert alert-err">&#10060; '+esc(GLTCloud.errorText(err))+'</div>';
  });
};
window.setStaffRoleUi=function(id,role){
  GLTCloud.setStaffRole(id,role).then(function(){ toast('Role updated'); loadStaffList(); },
    function(err){ toast(GLTCloud.errorText(err),'err'); loadStaffList(); });
};
window.setStaffActiveUi=function(id,active){
  if(!active && !confirm('Disable this login? They will be signed out and cannot use the app until you enable it again.')) return;
  GLTCloud.setStaffActive(id,active).then(function(){ toast(active?'Login enabled':'Login disabled'); loadStaffList(); },
    function(err){ toast(GLTCloud.errorText(err),'err'); loadStaffList(); });
};
window.changeMyPassword=function(){
  var a=(document.getElementById('pw_new')||{}).value||'', b=(document.getElementById('pw_new2')||{}).value||'';
  if(a.length<6){ toast('Use at least 6 characters','err'); return; }
  if(a!==b){ toast('The two passwords do not match','err'); return; }
  GLTCloud.changePassword(a).then(function(){
    toast('Password changed'); document.getElementById('pw_new').value=''; document.getElementById('pw_new2').value='';
  }, function(err){ toast(GLTCloud.errorText(err),'err'); });
};
window.changePricePassword=function(){
  var p=((document.getElementById('pp_new')||{}).value||'').trim();
  if(p.length<4){ toast('Use at least 4 characters','err'); return; }
  GLTCloud.setPricePassword(p).then(function(){
    appSettings=Object.assign({},appSettings,{price_edit_password:p}); lsSet('appSettings',appSettings);
    toast('Price-edit password saved'); document.getElementById('pp_new').value='';
  }, function(err){ toast(GLTCloud.errorText(err),'err'); });
};

// ---- helpers for Data & Sync ----
function cloudStatusHtml(){
  if(!cloudOn()) return '<div class="alert alert-warn" style="margin-bottom:0"><span>Not connected yet - log in to use the cloud.</span></div>';
  var n=GLTCloud.outboxCount(), p=GLTCloud.profile()||{};
  return '<div class="alert alert-ok" style="margin-bottom:0"><span>&#9989; Signed in as <strong>'+esc(p.username||'')+'</strong> ('+esc(p.role||'')+')'+
    (n?' &middot; <strong>'+n+'</strong> change(s) waiting to upload':' &middot; everything is uploaded')+'</span></div>';
}
window.uploadWaitingChanges=function(){
  if(!cloudOn()){ toast('Log in first','err'); return; }
  var n=GLTCloud.outboxCount();
  if(!n){ toast('Nothing is waiting - everything is uploaded.'); return; }
  toast('Uploading '+n+' waiting change(s)...');
  GLTCloud.flush().then(function(done){
    var left=GLTCloud.outboxCount();
    toast(left?left+' change(s) still waiting - the internet seems unavailable.':'All changes uploaded!', left?'err':'ok');
    var line=document.getElementById('cloud-status-line'); if(line) line.innerHTML=cloudStatusHtml();
  });
};
window.resetAllLocalData=function(){
  var n=(typeof GLTCloud!=='undefined')?GLTCloud.outboxCount():0;
  var msg='Reset ALL data on this device?'+(n?'\n\nWARNING: '+n+' change(s) have not uploaded yet and would be lost!':'');
  if(confirm(msg)){ localStorage.clear(); window.location.reload(); }
};

function toggleNewRefFields(val){
  var wrap=document.getElementById('nc-new-ref-fields');
  if(wrap) wrap.style.display = (val==='__new__') ? 'block' : 'none';
}

// Creates a new reference locally (copying prices from baseId) and syncs it
// to the backend. Calls cb(newId) once the cloud sync attempt has finished
// (success or failure), so callers can safely chain a dependent save (like
// adding a customer whose default reference is this brand-new one) without
// racing a background pull that hasn't picked up the new reference yet.
function createNewReference(name, baseId, cb){
  var newId = String(Math.max.apply(null, REF_LIST.map(function(r){ return parseInt(r.id, 10) || 0; })) + 1);

  // 1. Copy base prices to new ref for all products
  products.forEach(function(p) {
    if (!p.prices) p.prices = {};
    p.prices[newId] = p.prices[baseId] != null ? p.prices[baseId] : null;
  });

  // 2. Update local ref map
  REF_MAP[newId] = name;
  rebuildRefList();
  lsSet('refMap', REF_MAP);
  saveAll();

  toast('Creating reference #' + newId + ' (' + name + ') and syncing prices...', 'info');

  // 3. Save the reference to the cloud
  apiCall('addReference', {refId: newId, name: name, baseRefId: baseId}, function(res) {
    if (!res || res.status !== 'success') {
      toast('Reference saved on this device, cloud sync failed.', 'err');
      if (cb) cb(newId);
      return;
    }

    // 4. Upload the new price list for all products
    // (each product gets a price under the new reference id)
    apiCall('addRefPricesToSheet', {
      refId: newId,
      refName: name,
      baseRefId: baseId,
      products: products.map(function(p) {
        return {
          _id: p._id,
          name: p.name,
          prices: p.prices
        };
      })
    }, function(res2) {
      if (res2 && res2.status === 'success') {
        toast('✅ Reference #' + newId + ' (' + name + ') created and prices synced!', 'ok');
      } else {
        toast('Reference created. Use Data & Sync -> Push Stock to upload the prices.', 'err');
      }
      if (cb) cb(newId);
    });
  });
}

window.editCustomer=function(id){
  var c=customers.find(function(x){return String(x._id)===String(id);});
  if(!c){toast('Customer not found','err');return;}
  var refOpts=REF_LIST.map(function(r){return '<option value="'+r.id+'"'+(String(c.defaultRef)===String(r.id)?' selected':'')+'>#'+r.id+' — '+esc(r.name)+'</option>';}).join('');
  showModal(
    '<div class="modal">'+
    '<div class="modal-hdr"><span class="modal-title">&#9999; Edit Customer</span><button class="modal-x" onclick="closeModal()">&#10005;</button></div>'+
    '<div class="modal-body">'+
      '<div class="grid2">'+
        '<div class="fg"><label class="lbl">Name *</label><input class="inp" id="ec_name" value="'+esc(c.name||'')+'"></div>'+
        '<div class="fg"><label class="lbl">Contact 1</label><input class="inp" id="ec_ph" value="'+esc(c.contact||'')+'"></div>'+
        '<div class="fg"><label class="lbl">Contact 2</label><input class="inp" id="ec_ph2" value="'+esc(c.contact2||'')+'"></div>'+
        '<div class="fg"><label class="lbl">Address</label><input class="inp" id="ec_addr" value="'+esc(c.address||'')+'"></div>'+
        '<div class="fg"><label class="lbl">Aadhar Number</label><input class="inp" id="ec_aadhar" value="'+esc(c.aadhar||'')+'"></div>'+
        '<div class="fg"><label class="lbl">GST Number</label><input class="inp" id="ec_gst" value="'+esc(c.gst||'')+'"></div>'+
        '<div class="fg"><label class="lbl">Default Ref #</label><select class="sel" id="ec_ref"><option value="">— None —</option>'+refOpts+'</select></div>'+
      '</div>'+
    '</div>'+
    '<div class="modal-ftr">'+
      '<button class="btn btn-gh" onclick="closeModal()">Cancel</button>'+
      '<button class="btn btn-r" onclick="saveCustomerEdit(\''+esc(String(c._id))+'\')">&#128190; Save Changes</button>'+
    '</div></div>'
  );
};

window.saveCustomerEdit=function(id){
  var c=customers.find(function(x){return String(x._id)===String(id);});
  if(!c){toast('Customer not found','err');return;}
  var nm=(document.getElementById('ec_name')||{}).value||'';
  if(!nm.trim()){toast('Name required!','err');return;}
  c.name=nm.trim();
  c.contact=(document.getElementById('ec_ph')||{}).value||'';
  c.contact2=(document.getElementById('ec_ph2')||{}).value||'';
  c.address=(document.getElementById('ec_addr')||{}).value||'';
  c.aadhar=(document.getElementById('ec_aadhar')||{}).value||'';
  c.gst=(document.getElementById('ec_gst')||{}).value||'';
  c.defaultRef=(document.getElementById('ec_ref')||{}).value||'';
  saveAll();
  closeModal();
  toast('Saving changes...','info');
  apiCall('addCustomer',{customer:c},function(res){
    if(res.status==='success'){
      toast('Customer updated successfully!');
      gdPullFromScript();
    }else{
      toast('Saved locally, but cloud sync failed: '+res.message,'err');
    }
  });
};

window.showCustomerSummary=function(id){
  var c=customers.find(function(x){return String(x._id)===String(id);});
  if(!c){toast('Customer not found','err');return;}
  var stats=buildCustomerStats(c);
  var dueSign = stats.balanceDue < 0 ? '-' : '+';
  var dueColor = 'var(--text)';
  var statRows=[
    ['Total Estimate Amount',fmtMoney(stats.totalBilled)],
    ['Total Payment Amount',fmtMoney(stats.advancePaid)],
    ['Total Pending Loads Amount',fmtMoney(stats.pendingValue)]
  ].map(function(r){
    return '<tr><td style="font-weight:600;font-size:14px">'+r[0]+'</td><td class="num" style="font-weight:800">'+r[1]+'</td></tr>';
  }).join('');
  var ledgerRows=stats.ledger.map(function(row){
    var ref=row.type==='advance'?'&#128176; Advance Payment':'#'+esc(row.billNumber);
    return '<tr'+(row.type==='advance'?' style="background:rgba(22,163,74,0.06)"':'')+'>'+
      '<td style="font-size:13.5px">'+row.displayDate+'</td>'+
      '<td style="font-size:14px;font-weight:700'+(row.type==='advance'?';color:var(--green-text)':'')+'">'+ref+'</td>'+
      '<td class="num" style="font-size:14px">'+(row.estimateAmount?fmtMoney(row.estimateAmount):'—')+'</td>'+
      '<td class="num" style="font-size:14px;color:var(--green-text)">'+(row.paymentAmount?fmtMoney(row.paymentAmount):'—')+'</td>'+
      '<td class="num" style="font-size:14px;color:var(--red-text)">'+(row.pendingAmount?fmtMoney(row.pendingAmount):'—')+'</td></tr>';
  }).join('');
  var totRow='<tr style="background:var(--btn-sec-bg);font-weight:800"><td colspan="2" style="font-size:14px">TOTAL</td>'+
    '<td class="num" style="font-size:14px">'+fmtMoney(stats.totalBilled)+'</td>'+
    '<td class="num" style="font-size:14px;color:var(--green-text)">'+fmtMoney(stats.advancePaid)+'</td>'+
    '<td class="num" style="font-size:14px;color:var(--red-text)">'+fmtMoney(stats.pendingValue)+'</td></tr>';
  showModal(
    '<div class="modal" style="max-width:640px">'+
    '<div class="modal-hdr"><span class="modal-title">&#128202; '+esc(c.name)+' — Summary</span><button class="modal-x" onclick="closeModal()">&#10005;</button></div>'+
    '<div class="modal-body">'+
      '<div class="tbl-wrap" style="margin-bottom:10px"><table class="tbl"><tbody>'+statRows+'</tbody></table></div>'+
      '<div style="text-align:center;padding:10px;border:2px solid var(--card-border);border-radius:10px;margin-bottom:14px">'+
        '<div style="font-size:13px;color:var(--text-muted);text-transform:uppercase;font-weight:700">Total Due (Estimate &minus; Payment &minus; Pending Loads)</div>'+
        '<div style="font-size:26px;font-weight:800;color:var(--text)">'+dueSign+fmtMoney(Math.abs(stats.balanceDue))+'</div>'+
      '</div>'+
      '<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px;padding:10px;background:var(--btn-sec-bg);border-radius:10px;border:1px dashed var(--card-border)">'+
        '<div class="fg" style="margin-bottom:0;flex:1;min-width:130px"><label class="lbl">Payment Date</label><input class="inp" type="date" id="adv-date" value="'+new Date().toISOString().slice(0,10)+'"></div>'+
        '<div class="fg" style="margin-bottom:0;flex:1;min-width:110px"><label class="lbl">Amount (&#8377;)</label><input class="inp" type="number" id="adv-amount" placeholder="0"></div>'+
        '<button class="btn btn-g" onclick="addAdvancePayment(\''+esc(String(c._id))+'\')">&#10010; Record Payment</button>'+
      '</div>'+
      '<div class="card-title" style="font-size:15px;margin-bottom:6px">Statement (Bills &amp; Advances, by Date)</div>'+
      (stats.ledger.length?'<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Reference</th><th style="text-align:right">Estimate</th><th style="text-align:right">Payment</th><th style="text-align:right">Pending</th></tr></thead><tbody>'+ledgerRows+totRow+'</tbody></table></div>'
        :'<div class="empty" style="padding:16px"><div class="empty-txt">No bills or advance payments for this customer yet.</div></div>')+
    '</div>'+
    '<div class="modal-ftr">'+
      '<button class="btn btn-gh" onclick="closeModal()">Close</button>'+
      '<button class="btn btn-b" onclick="printCustomerStatement(\''+esc(String(c._id))+'\')">&#128424; Print</button>'+
      '<button class="btn btn-r" onclick="downloadCustomerStatementPdf(\''+esc(String(c._id))+'\')">&#8681; PDF</button>'+
      '<button class="btn" style="background:#25D366;color:#fff" onclick="shareCustomerStatementWhatsApp(\''+esc(String(c._id))+'\')">&#128241; Share via WhatsApp</button>'+
    '</div></div>'
  );
};

window.addAdvancePayment=function(id){
  var c=customers.find(function(x){return String(x._id)===String(id);});
  if(!c){toast('Customer not found','err');return;}
  var dateEl=document.getElementById('adv-date');
  var amtEl=document.getElementById('adv-amount');
  var date=dateEl?dateEl.value:'';
  var amount=amtEl?Number(amtEl.value):0;
  if(!date){toast('Pick a payment date!','err');return;}
  if(!amount||amount<=0){toast('Enter a valid amount!','err');return;}
  if(!c.advancePayments) c.advancePayments=[];
  c.advancePayments.push({date:date,amount:amount});
  saveAll();
  toast('Advance payment of '+fmtMoney(amount)+' recorded.','ok');
  apiCall('addCustomer',{customer:c},function(res){
    if(!res||res.status!=='success'){
      toast('Saved locally, but cloud sync failed — check connection.','err');
    }
  });
  showCustomerSummary(id);
};

window.addCust=function(){
  var nm=(document.getElementById('nc_name')||{}).value||'';
  if(!nm.trim()){toast('Name required!','err');return;}
  var addr=(document.getElementById('nc_addr')||{}).value||'';
  var ph=(document.getElementById('nc_ph')||{}).value||'';
  var ph2=(document.getElementById('nc_ph2')||{}).value||'';
  var aadhar=(document.getElementById('nc_aadhar')||{}).value||'';
  var gst=(document.getElementById('nc_gst')||{}).value||'';
  var refVal=(document.getElementById('nc_ref')||{}).value||'';

  function saveCustomer(finalRef){
    var newCust={
      _id:genId(),
      name:nm.trim(),
      address:addr,
      contact:ph,
      contact2:ph2,
      aadhar:aadhar,
      gst:gst,
      advancePayments:[],
      defaultRef:finalRef
    };
    customers.push(newCust); saveAll();      // visible immediately, even before it reaches the cloud
    toast('Saving customer...','info');
    apiCall('addCustomer',{customer:newCust},function(res){
      if(res.status==='success'){
        toast('Customer added successfully!');
        gdPullFromScript();
      }else{
        toast('Failed to save customer: '+res.message,'err');
      }
    });
  }

  if(refVal==='__new__'){
    var newRefName=(document.getElementById('nc_new_ref_name')||{}).value||'';
    var newRefBase=(document.getElementById('nc_new_ref_base')||{}).value||'';
    newRefName=newRefName.trim();
    if(!newRefName){toast('New reference name is required!','err');return;}
    if(!newRefBase){toast('Pick a reference to copy prices from!','err');return;}
    createNewReference(newRefName,newRefBase,function(newId){
      toast('Reference "'+newRefName+'" created (Ref #'+newId+')!');
      saveCustomer(newId);
    });
  }else{
    saveCustomer(refVal);
  }
};

function exportData(){
  var d={products:products,customers:customers,bills:bills,date:new Date().toISOString(),v:'1.0'};
  var blob=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='GLT_Backup_'+todayCode()+'.json';a.click();
  toast('Backup downloaded!');
}

function importData(){
  var f=(document.getElementById('imp_file')||{}).files;
  if(!f||!f[0]){toast('Select a file first!','err');return;}
  var r=new FileReader();
  r.onload=function(ev){
    try{
      var d=JSON.parse(ev.target.result);
      if(d.products)products=d.products;if(d.customers)customers=d.customers;if(d.bills)bills=d.bills;
      saveAll();toast('Imported!');renderSettings();
    }catch(e){toast('Invalid file: '+e.message,'err');}
  };
  r.readAsText(f[0]);
}





// == STOCK MANAGEMENT ==
function renderStockMgr(){
  var el=document.getElementById('stab-body');if(!el)return;
  var q=stkSearch.toLowerCase().trim();
  var filteredProducts=q?products.filter(function(p){return (p.name||'').toLowerCase().indexOf(q)>=0||(p.category||'').toLowerCase().indexOf(q)>=0||(p.company||'').toLowerCase().indexOf(q)>=0||(p.uom||'').toLowerCase().indexOf(q)>=0;}):products;
  var refCols=REF_LIST.map(function(r){return '<th style="background:#7c3aed;color:#fff;white-space:nowrap">&#8377; Ref#'+r.id+'<br><span style="font-size:12px;font-weight:400">'+esc(r.name)+'</span></th>';}).join('');
  var rows=filteredProducts.map(function(p){
    var refPrices=REF_LIST.map(function(r){
      var price=(p.prices&&p.prices[r.id])?p.prices[r.id]:'';
      return '<td><input type="number" min="0" step="0.01" style="width:65px;padding:3px 5px;border:1px solid var(--card-border);background:var(--input-bg);color:var(--text-main);border-radius:4px;font-size:14px" value="'+price+'" onchange="updateProductField(\''+p._id+'\',\'price_'+r.id+'\',this.value)"></td>';
    }).join('');
    return '<tr>'+
      '<td style="font-size:14px;font-weight:700;min-width:140px">'+esc(p.name)+'</td>'+
      
      '<td style="font-size:13px">'+esc(p.uom||'')+'</td>'+
      '<td><input type="number" min="0" style="width:70px;padding:3px 5px;border:1px solid var(--danger);background:var(--input-bg);color:var(--text-main);border-radius:4px;font-size:15px;font-weight:700;text-align:center" value="'+(p.qtyPerCase||'')+'" placeholder="—" onchange="updateProductField(\''+p._id+'\',\'qtyPerCase\',this.value)"></td>'+
      '<td><input type="number" min="0" step="0.5" style="width:70px;padding:3px 5px;border:2px solid var(--warning);background:var(--btn-sec-bg);color:var(--text-main);border-radius:4px;font-size:15px;font-weight:700;text-align:center" value="'+(p.stockCases||0)+'" onchange="updateProductField(\''+p._id+'\',\'stockCases\',this.value)"></td>'+
      '<td><input type="number" min="0" style="width:70px;padding:3px 5px;border:2px solid var(--success);background:var(--btn-sec-bg);color:var(--text-main);border-radius:4px;font-size:15px;font-weight:700;text-align:center" value="'+(p.stockLoose||0)+'" onchange="updateProductField(\''+p._id+'\',\'stockLoose\',this.value)"></td>'+
      '<td style="font-weight:800;font-size:15px;color:var(--danger);text-align:center">'+(p.stock||0)+'</td>'+
      '<td><input type="number" min="0" step="0.01" style="width:72px;padding:3px 5px;border:1px solid #0f766e;background:var(--input-bg);color:var(--text-main);border-radius:4px;font-size:14px;text-align:center" value="'+(p.costPrice||'')+'" placeholder="0" onchange="updateProductField(\''+p._id+'\',\'costPrice\',this.value)"></td>'+
      refPrices+
    '</tr>';
  }).join('');
  el.innerHTML=
    '<div class="card">'+
      '<div class="card-title">&#128230; Stock & Price Manager</div>'+
      '<div class="alert alert-info" style="margin-bottom:10px">&#9432; Edit stock and prices directly. <strong>Cases &times; Qty/Case + Loose = Total Stock</strong>. Click Save All when done.</div>'+
      '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center">'+
        '<button class="btn btn-g" onclick="saveAllStock()">&#128190; Save All</button>'+
        '<button class="btn btn-b" onclick="exportStockExcel()">&#8681; Download Excel</button>'+
        '<button class="btn btn-o" onclick="document.getElementById(\'stk-file\').click()">&#8679; Import CSV</button>'+
        '<input type="file" id="stk-file" accept=".csv" style="display:none" onchange="importStockCSV(this)">'+
      '</div>'+
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">'+
        '<div class="srch-wrap" style="flex:1;max-width:340px"><span class="srch-ico">&#128269;</span>'+
        '<input class="srch-inp" id="stk-search" value="'+esc(stkSearch)+'" placeholder="Search name or category..." oninput="stkSearch=this.value;renderStockMgr()"></div>'+
        '<span class="tag tag-gy" id="stk-count">'+filteredProducts.length+' / '+products.length+' products</span>'+
      '</div>'+
      '<div style="overflow:auto;max-height:65vh;border:1px solid var(--card-border);border-radius:8px"><table class="tbl" style="font-size:14px;min-width:850px">'+
        '<thead style="position:sticky;top:0;z-index:2"><tr>'+
          '<th style="min-width:180px">Product</th><th>UOM</th>'+
          '<th style="background:var(--danger);color:#fff">Qty/Case</th>'+
          '<th style="background:var(--warning);color:#000">Cases&#128230;</th>'+
          '<th style="background:var(--success);color:#fff">Loose&#128290;</th>'+
          '<th style="background:var(--danger);color:#fff">Total&#9654;</th>'+
          '<th style="background:#0f766e;color:#fff;white-space:nowrap">&#8377; Cost Price</th>'+
          refCols+
        '</tr></thead>'+
        '<tbody>'+rows+'</tbody>'+
      '</table></div>'+
    '</div>';
  // Restore focus to search box after re-render so typing continues uninterrupted
  setTimeout(function(){
    var s=document.getElementById('stk-search');
    if(s && document.activeElement !== s && stkSearch){
      s.focus();
      s.setSelectionRange(s.value.length, s.value.length);
    }
  }, 0);
}

function updateProductField(pid,field,val){
  var idx=products.findIndex(function(p){return p._id===pid;});
  if(idx<0)return;
  var p=Object.assign({},products[idx]);
  if(field.indexOf('price_')===0){
    var rid=field.replace('price_','');
    p.prices=Object.assign({},p.prices||{});
    p.prices[rid]=val?Number(val):null;
  } else if(field==='stockCases'||field==='stockLoose'||field==='qtyPerCase'){
    p[field]=Math.max(0,Number(val)||0);
    var cases=field==='stockCases'?p.stockCases:(p.stockCases||0);
    var loose=field==='stockLoose'?p.stockLoose:(p.stockLoose||0);
    var qpc=field==='qtyPerCase'?p.qtyPerCase:(p.qtyPerCase||0);
    p.stock=(cases*qpc)+loose;
  } else if(field==='costPrice'){
    p.costPrice=val?Number(val):null;
  } else {
    p[field]=val;
  }
  p.updatedAt = new Date().toISOString();
  p.updatedBy = (typeof curUser !== 'undefined' && curUser && curUser.username) ? curUser.username : (lsGet('currentUser') || 'admin');
  products[idx] = p;
  saveAll(); // persist to localStorage immediately

  // Auto-sync this single product to the cloud in the background
  // No need to click "Save All" — every change syncs automatically
  if (cloudOn()) {
    clearTimeout(window._stkSyncTimer);
    window._stkSyncTimer = setTimeout(function() {
      // Collect all products changed in the last 1.5 seconds (batches rapid edits)
      var toSync = products.filter(function(pr) {
        return pr.updatedAt && (Date.now() - new Date(pr.updatedAt).getTime()) < 3000;
      });
      if (toSync.length > 0) {
        apiCall('updateStock', {products: toSync}, function(res) {
          if (res.status === 'success') {
            toast('&#9989; ' + toSync.length + ' item(s) synced!', 'ok');
          } else {
            toast('Sync failed: ' + (res.message||'unknown'), 'err');
          }
        });
      }
    }, 1500); // wait 1.5s to batch rapid edits
  }
}

function saveAllStock(){
  saveAll();
  toast('&#9989; Saving all...','ok');
  if(cloudOn()) {
    gdPushStockToScript();
  }
  renderStockMgr();
}

function exportStockExcel(){
  var refHeaders=REF_LIST.map(function(r){return 'Price Ref#'+r.id+' ('+r.name+')';});
  var headers=['Product Name','Company','Category','UOM','Qty Per Case','Cases In Stock','Loose Pieces','Total Stock','Cost Price'].concat(refHeaders);
  var rows=[headers];
  products.forEach(function(p){
    var refPrices=REF_LIST.map(function(r){return (p.prices&&p.prices[r.id])?p.prices[r.id]:'';});
    rows.push([
      p.name||'',p.company||'',p.category||'',p.uom||'',
      p.qtyPerCase||'',p.stockCases||0,p.stockLoose||0,p.stock||0,p.costPrice||''
    ].concat(refPrices));
  });
  var csv=rows.map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  var d=new Date();
  a.download='GLT_Stock_'+d.getDate()+'_'+(d.getMonth()+1)+'_'+d.getFullYear()+'.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  toast('&#8681; Excel downloaded!','ok');
}

function importStockCSV(input){
  var file=input.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(e){
    var lines=e.target.result.split('\n');
    var headers=lines[0].split(',').map(function(c){return c.replace(/^"|"$/g,'').trim();});
    var updated=0;
    lines.slice(1).forEach(function(line){
      if(!line.trim())return;
      var cols=[];var cur='';var inQ=false;
      for(var ci=0;ci<line.length;ci++){
        var ch=line[ci];
        if(ch==='"'){inQ=!inQ;}
        else if(ch===','&&!inQ){cols.push(cur.trim());cur='';}
        else{cur+=ch;}
      }
      cols.push(cur.trim());
      var name=cols[0]&&cols[0].replace(/^"|"$/g,'');
      if(!name)return;
      var idx=products.findIndex(function(p){return p.name.toLowerCase()===name.toLowerCase();});
      if(idx<0)return;
      var p=Object.assign({},products[idx]);
      if(cols[4]!==undefined&&cols[4]!=='')p.qtyPerCase=Number(cols[4])||0;
      if(cols[5]!==undefined&&cols[5]!=='')p.stockCases=Number(cols[5])||0;
      if(cols[6]!==undefined&&cols[6]!=='')p.stockLoose=Number(cols[6])||0;
      if(cols[7]!==undefined&&cols[7]!=='')p.stock=Number(cols[7])||0;
      else p.stock=(p.stockCases||0)*(p.qtyPerCase||0)+(p.stockLoose||0);
      p.prices=p.prices||{};
      REF_LIST.forEach(function(r,ri){
        var col=cols[8+ri];
        if(col!==undefined&&col!=='')p.prices[r.id]=Number(col.replace(/^"|"$/g,''))||null;
      });
      products[idx]=p;updated++;
    });
    saveAll();
    toast('&#9989; Updated '+updated+' products from CSV!','ok');
    if(cloudOn()){
      gdPushStockToScript();
    }
    renderStockMgr();
  };
  reader.readAsText(file);
  input.value='';
}

// == THEME (PERMANENT DARK MODE) ==

window.bulkSetCostPrice = function() {
  if (!confirm('Set Cost Price to ₹10 for all ' + products.length + ' products? This overwrites any existing cost price values. (Local only for now — there\'s no Cost Price column in the sheet yet, so this won\'t sync until one is added.)')) return;
  products.forEach(function(p) { p.costPrice = 10; });
  saveAll();
  toast('Cost Price set to ₹10 for all ' + products.length + ' products.');
  renderStab();
};

// == CLOUD SYNC (Supabase) ==
// All traffic with the cloud database goes through js/cloud.js (GLTCloud).
// The function names below are the ones the rest of the app already calls.
var sessionId = genId();
var reservationTotals = {};

// true once someone is logged in and the cloud library is configured
function cloudOn() {
  // signed in on this device. (Even if the connection or the cloud library is unavailable the
  // app keeps working and queues changes for upload - see js/cloud.js)
  return typeof GLTCloud !== 'undefined' && GLTCloud.signedIn();
}

function gdTestScriptConnection() {
  var s = document.getElementById('gd-script-status');
  if (!cloudOn()) {
    toast(typeof GLTCloud !== 'undefined' && GLTCloud.configured() ? 'Please log in first!' : (typeof GLTCloud !== 'undefined' ? GLTCloud.configHelp() : 'Cloud library missing'), 'err');
    return;
  }
  if (s) s.innerHTML = '<div class="alert alert-info">&#8987; Testing connection...</div>';
  GLTCloud.test().then(function(d) {
    if (s) s.innerHTML = '<div class="alert alert-ok">&#9989; Connection successful! ' + esc(d.message) + '</div>';
    toast('Connection successful!');
  }, function(err) {
    if (s) s.innerHTML = '<div class="alert alert-err">&#10060; Connection failed: ' + esc(GLTCloud.errorText(err)) + '</div>';
    toast('Connection failed!', 'err');
  });
}

function triggerSmartSync() {
  if (!cloudOn()) {
    toast('Please log in first!', 'err');
    return;
  }

  var icon = document.getElementById('sync-icon');
  var badge = document.getElementById('sync-status-badge');
  var btn = document.getElementById('btn-sync-all');

  if (icon) icon.classList.add('spinning');
  if (btn) btn.disabled = true;
  if (badge) badge.innerHTML = '<span style="color:var(--info)">Syncing...</span>';
  toast('&#8987; Syncing data with the cloud...', 'info');

  var currentUser = (typeof curUser !== 'undefined' && curUser && curUser.username) ? curUser.username : (lsGet('currentUser') || 'admin');
  var currentRole = (typeof curUser !== 'undefined' && curUser && curUser.role) ? curUser.role : 'admin';
  var nowIso = new Date().toISOString();

  var payload = {
    products: products,
    bills: bills,
    customers: customers,
    updatedAt: nowIso,
    updatedBy: currentUser + ' (' + currentRole + ')'
  };

  apiCall('smartSync', payload, function(res) {
    if (icon) icon.classList.remove('spinning');
    if (btn) btn.disabled = false;

    if (!res || res.status === 'error') {
      if (badge) badge.innerHTML = '<span style="color:var(--warning)">Offline Mode</span>';
      toast('Sync Info: ' + ((res && res.message) || 'Working in offline mode'), 'info');
      return;
    }

    var timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    if (badge) badge.innerHTML = 'Synced ' + timeStr + ' by ' + esc(currentUser);
    lsSet('lastSyncInfo', { time: timeStr, user: currentUser, timestamp: nowIso });
    toast('&#9989; Data synced! (' + products.length + ' products, ' + bills.length + ' bills)', 'ok');
  });
}

// Background refresh. Asks the cloud only for products/customers that changed
// since the last refresh, so it stays light on a weak connection.
function gdPullFromScriptSilently(cb) {
  if (!cloudOn()) {
    if (cb) cb();
    return;
  }
  // 8-second wait — if the connection is slow, carry on with local data
  var pullDone = false;
  var pullTimer = setTimeout(function() {
    if (!pullDone) { pullDone = true; console.log('Silent pull timed out, using local data'); if (cb) cb(); }
  }, 8000);
  GLTCloud.getData({ delta: true, includeBills: true })      // only what changed since the last refresh
    .then(function(d) {
      mergeServerData(d, true);    // also when it arrives after the wait: the delta must never be dropped
      if (!pullDone) { pullDone = true; clearTimeout(pullTimer); if (cb) cb(); }
    })
    .catch(function(err) {
      if (!pullDone) { pullDone = true; clearTimeout(pullTimer); console.log('Silent pull failed:', err); if (cb) cb(); }
    });
}

// Replace products on this device with what is in the cloud database.
// Estimates, customers and users are NOT touched.
function gdHardResetProductsFromSheet() {
  if (!cloudOn()) {
    toast('Please log in first!', 'err');
    return;
  }
  var waiting = GLTCloud.outboxCount();
  if (!confirm('This will REPLACE all product data (stock, prices, qty per case, cost price) on this device with what is stored in the cloud database.' +
               (waiting ? '\n\nWARNING: ' + waiting + ' change(s) made on this device have not uploaded yet and would be lost.' : '') +
               '\n\nYour estimates and customers will NOT be affected.\n\nContinue?')) return;

  toast('&#8987; Fetching fresh product data from the cloud...', 'info');
  GLTCloud.getData({})
    .then(function(d) {
      if (!d || !d.products || d.products.length === 0) {
        toast('No product data found in the cloud database.', 'err');
        return;
      }
      products = d.products.map(function(rp) {
        var qpc   = rp.qtyPerCase || 0;
        var cases = rp.stockCases || 0;
        var loose = rp.stockLoose || 0;
        rp.stock  = qpc > 0 ? (cases * qpc + loose) : loose;
        return rp;
      });
      saveAll();
      toast('&#9989; Product data fully reset from the cloud (' + products.length + ' products)!', 'ok');
      renderPage(curTab);
    })
    .catch(function(err) {
      toast('Reset failed: ' + GLTCloud.errorText(err), 'err');
    });
}

// Manual full pull (Settings -> Data & Sync -> Pull All Data)
function gdPullFromScript() {
  if (!cloudOn()) {
    toast('Please log in first!', 'err');
    return;
  }
  toast('Syncing database from the cloud...', 'ok');
  var s = document.getElementById('gd-script-status');
  if (s) s.innerHTML = '<div class="alert alert-info">&#8987; Syncing database...</div>';

  GLTCloud.getData({ includeBills: true, allBills: true })
    .then(function(d) {
      if (d.products && d.products.length > 0) {
        products = d.products; // Full product replace on manual pull
        if (d.customers) customers = d.customers;
        // Merge estimates — add new ones from the cloud, refresh older local copies
        if (d.bills) mergeCloudBills(d.bills);
        if (d.references && d.references.length) {
          d.references.forEach(function(r){ if (r.id && r.name) REF_MAP[String(r.id)] = r.name; });
          rebuildRefList(); lsSet('refMap', REF_MAP);
        }
        saveAll();
        toast('&#9989; Database synced successfully!', 'ok');
        if (s) s.innerHTML = '<div class="alert alert-ok">&#9989; Database pull complete. Synced ' + products.length + ' products, ' + (customers.length) + ' customers, ' + (bills.length) + ' estimates.</div>';
        renderPage(curTab);
      } else {
        toast('Sync failed: the cloud database has no products yet', 'err');
        if (s) s.innerHTML = '<div class="alert alert-err">&#10060; Sync failed: no products found in the cloud database. Run the data migration first (see supabase/SETUP-GUIDE.html).</div>';
      }
    })
    .catch(function(err) {
      toast('Sync failed: ' + GLTCloud.errorText(err), 'err');
      if (s) s.innerHTML = '<div class="alert alert-err">&#10060; Sync failed: ' + esc(GLTCloud.errorText(err)) + '</div>';
    });
}

function gdPushStockToScript() {
  if (!cloudOn()) {
    toast('Please log in first!', 'err');
    return;
  }
  toast('Uploading stock to the cloud...', 'ok');
  var s = document.getElementById('gd-script-status');
  if (s) s.innerHTML = '<div class="alert alert-info">&#8987; Uploading stock...</div>';

  apiCall('updateStock', {products: products, force: true}, function(res) {
    if (res.status === 'success') {
      toast(res.queued ? 'No internet - stock saved on this device, will upload automatically.' : 'Stock uploaded to the cloud!', res.queued ? 'err' : 'ok');
      if (s) s.innerHTML = '<div class="alert alert-ok">&#9989; ' + (res.queued ? 'Stock will upload as soon as the internet is back.' : 'Stock pushed to the cloud database successfully.') + '</div>';
    } else {
      toast('Upload failed: ' + res.message, 'err');
      if (s) s.innerHTML = '<div class="alert alert-err">&#10060; Upload failed: ' + esc(res.message) + '</div>';
    }
  });
}

// Same signature as before: apiCall(action, data, callback(res))
function apiCall(action, data, cb) {
  if (!cloudOn()) return;
  data = data || {};
  data.sessionId = sessionId;
  GLTCloud.call(action, data, cb);
}

function apiReserve(productId, qty) {
  if (!cloudOn()) return;
  apiCall('reserve', {productId: productId, qty: qty}, function(res) {
    apiFetchReservations();
  });
}

function apiRelease(productId) {
  if (!cloudOn()) return;
  apiCall('release', {productId: productId}, function(res) {
    apiFetchReservations();
  });
}

function apiReleaseAll() {
  if (!cloudOn()) return;
  apiCall('releaseAll', {}, function(res) {
    reservationTotals = {};
  });
}

function apiFetchReservations(cb) {
  if (!cloudOn()) {
    if (cb) cb();
    return;
  }
  GLTCloud.getReservations()
    .then(function(res) {
      reservationTotals = res.reservations || {};
      if (cb) cb();
    })
    .catch(function(err) {
      console.log("Failed to fetch reservations:", err);
      if (cb) cb();
    });
}

// == BILL EDITING LOCKS ==
// Prevents the same estimate being edited on two devices at once. Whoever
// clicks "Edit" first gets the lock; anyone else opening that estimate from
// another device gets a view-only preview instead until it's released.
var billLocks = {};

function apiAcquireBillLock(billId, cb) {
  if (!cloudOn()) { if (cb) cb({status: 'success'}); return; }
  var uname = (typeof curUser !== 'undefined' && curUser && curUser.username) ? curUser.username : 'Someone';
  apiCall('acquireBillLock', {billId: billId, username: uname}, function(res) {
    if (cb) cb(res || {status: 'error'});
  });
}

function apiReleaseBillLock(billId) {
  if (!cloudOn() || !billId) return;
  apiCall('releaseBillLock', {billId: billId}, function() {});
}

function apiFetchBillLocks(cb) {
  if (!cloudOn()) { if (cb) cb(); return; }
  GLTCloud.getBillLocks()
    .then(function(res) {
      if (res.locks) billLocks = res.locks;
      if (cb) cb();
    })
    .catch(function(err) {
      console.log("Failed to fetch bill locks:", err);
      if (cb) cb();
    });
}

// Saves the estimate to the cloud database. The shareable PDF link is created
// only when someone taps "Share via WhatsApp" — no PDF is uploaded on every
// save, which keeps saving fast on a weak connection.
function saveBillToCloud(bill, oldItems) {
  if (!cloudOn()) return;
  apiCall('saveBill', {bill: bill, oldItems: oldItems || null}, function(res) {
    if (res.status === 'success') {
      if (res.queued) {
        toast('No internet - estimate saved on this device, it will upload automatically.', 'err');
      } else {
        toast('&#9989; Estimate saved to the cloud!', 'ok');
      }
      if (curTab === 'history') renderHistoryList();
    } else {
      toast('Cloud save failed: ' + (res.message||'check connection'), 'err');
    }
  });
  // Also push the updated stock (only products that changed are sent)
  setTimeout(function() {
    apiCall('updateStock', {products: products}, function(res) {
      if (res.status === 'success') {
        console.log('[Stock] Stock push complete after estimate save');
      }
    });
  }, 2000);
}

// Release reservations / edit lock when the tab closes
window.addEventListener('beforeunload', function() {
  if (!cloudOn()) return;
  if (billItems.length > 0 || window._editingOriginalId) {
    GLTCloud.releaseOnUnload(sessionId, window._editingOriginalId || null);
  }
});

// Periodic reservation refresh in billing session (every 45 seconds)
setInterval(function() {
  if (curTab === 'billing' || curTab === 'inventory') {
    apiFetchReservations(function() {
      if (curTab === 'billing' && selectedProduct) {
        renderSelProd();
      }
    });
  }
  if (curTab === 'history') {
    apiFetchBillLocks(function() { renderHistoryList(); });
  }
}, 45000);

// Periodic background data sync (every 20 seconds) so changes made on
// another device (e.g. a bill saved on mobile) show up here without
// needing to manually switch tabs. Skipped while on the Billing tab
// (which already tracks live reservations above, and a full re-render
// there would wipe out an in-progress, unsaved bill) and skipped while
// the user is actively typing anywhere, so it never yanks focus away
// mid-input.
setInterval(function() {
  if (!cloudOn()) return;
  if (curTab === 'billing') return;
  var activeTag = document.activeElement ? document.activeElement.tagName : '';
  if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
  gdPullFromScriptSilently(function() {
    renderPage(curTab);
  });
}, 20000);

// Password check for editing a price inside an estimate. The password lives
// only in the database; employees can't read it, they can only test a guess.
function checkPricePassword(pwd, cb) {
  var role = (typeof curUser !== 'undefined' && curUser && curUser.role) ? curUser.role : userRole;
  if (!cloudOn()) { cb(false, 'Please log in first'); return; }
  GLTCloud.verifyPricePassword(pwd).then(function(ok) {
    cb(!!ok, null);
  }, function(err) {
    if (GLTCloud.isNetworkError(err) && role === 'admin' && appSettings && appSettings['price_edit_password']) {
      cb(pwd === appSettings['price_edit_password'], null);    // offline: admins fall back to their saved copy
    } else {
      cb(false, GLTCloud.errorText(err));
    }
  });
}

// == INIT ==
document.addEventListener('DOMContentLoaded',function(){
  var lastInfo = lsGet('lastSyncInfo');
  if (lastInfo && lastInfo.time) {
    var b = document.getElementById('sync-status-badge');
    if (b) b.innerHTML = 'Synced ' + lastInfo.time + ' by ' + esc(lastInfo.user || 'User');
  }
  initLogin(); // Login runs immediately — no network wait
  // Fetch reservations in background after page is ready
  setTimeout(function() { apiFetchReservations(); }, 2000);
});
