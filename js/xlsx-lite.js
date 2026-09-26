/* Tiny Excel (.xlsx) reader / writer - no library needed.
   build(sheets)  -> Uint8Array of a real .xlsx file
       sheets = [{ name, rows: [[cell, ...], ...], widths: [12, 40, ...], freeze: {cols: 3, rows: 1}, priceCols: [3, 4],
                   filter: true }]      (cell = string | number | null;  priceCols = 0-based columns shown as editable prices)
   read(arrayBuffer) -> Promise of [{ name, rows: [[value, ...], ...] }]   (values: string | number | null)
   Reading uses the browser's built-in DecompressionStream, so nothing is downloaded. */
(function (root) {
  'use strict';
  var enc = new TextEncoder(), dec = new TextDecoder('utf-8');

  // ---------- zip (stored, no compression) ----------
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
    return t;
  })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

  function zip(files) {
    var chunks = [], central = [], offset = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = f.data, crc = crc32(data);
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, 0, true); lh.setUint16(12, 0x0021, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      chunks.push(new Uint8Array(lh.buffer), name, data);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, 0, true); ch.setUint16(14, 0x0021, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var cdSize = 0; central.forEach(function (c) { cdSize += c.length; });
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    var all = chunks.concat(central, [new Uint8Array(end.buffer)]), total = 0;
    all.forEach(function (a) { total += a.length; });
    var out = new Uint8Array(total), p = 0;
    all.forEach(function (a) { out.set(a, p); p += a.length; });
    return out;
  }

  function inflateRaw(u8) {
    return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()
      .then(function (b) { return new Uint8Array(b); });
  }

  // returns Promise of { 'path/in/zip': Uint8Array }
  function unzip(buf) {
    var u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var eocd = -1;
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return Promise.reject(new Error('This is not an Excel (.xlsx) file.'));
    var count = dv.getUint16(eocd + 10, true), p = dv.getUint32(eocd + 16, true), entries = [];
    for (var n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      var nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
      var name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      entries.push({ name: name, method: method, csize: csize, lho: lho });
      p += 46 + nlen + elen + clen;
    }
    var out = {};
    return entries.reduce(function (chain, e) {
      return chain.then(function () {
        var lnl = dv.getUint16(e.lho + 26, true), lel = dv.getUint16(e.lho + 28, true), start = e.lho + 30 + lnl + lel;
        var data = u8.subarray(start, start + e.csize);
        if (e.method === 0) { out[e.name] = data; return; }
        if (e.method === 8) return inflateRaw(data).then(function (d) { out[e.name] = d; });
      });
    }, Promise.resolve()).then(function () { return out; });
  }

  // ---------- xml helpers ----------
  function xesc(s) { return String(s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function xunesc(s) {
    return String(s).replace(/&#x([0-9a-fA-F]+);/g, function (_, h) { return String.fromCodePoint(parseInt(h, 16)); })
      .replace(/&#(\d+);/g, function (_, d) { return String.fromCodePoint(parseInt(d, 10)); })
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }
  function colName(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function colIndex(ref) { var m = /^([A-Z]+)/.exec(ref); var n = 0; for (var i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64); return n - 1; }

  // ---------- writer ----------
  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF4C542"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF8DC"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  function sheetXml(sh) {
    var rows = sh.rows || [], price = {}, maxCol = 0;
    (sh.priceCols || []).forEach(function (c) { price[c] = 1; });
    rows.forEach(function (r) { if (r.length > maxCol) maxCol = r.length; });
    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    if (sh.freeze) {
      var fc = sh.freeze.cols || 0, fr = sh.freeze.rows || 0;
      x += '<sheetViews><sheetView workbookViewId="0"><pane' + (fc ? ' xSplit="' + fc + '"' : '') + (fr ? ' ySplit="' + fr + '"' : '') +
        ' topLeftCell="' + colName(fc) + (fr + 1) + '" activePane="' + (fc && fr ? 'bottomRight' : (fr ? 'bottomLeft' : 'topRight')) + '" state="frozen"/></sheetView></sheetViews>';
    }
    if (sh.widths && sh.widths.length) {
      x += '<cols>' + sh.widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>';
    }
    x += '<sheetData>';
    rows.forEach(function (r, ri) {
      x += '<row r="' + (ri + 1) + '">';
      r.forEach(function (v, ci) {
        if (v === null || v === undefined || v === '') return;
        var ref = colName(ci) + (ri + 1), head = ri === 0 && sh.header !== false;
        var s = head ? (price[ci] ? 2 : 1) : (price[ci] ? 3 : 0);
        if (typeof v === 'number' && isFinite(v)) x += '<c r="' + ref + '"' + (s ? ' s="' + s + '"' : '') + '><v>' + v + '</v></c>';
        else x += '<c r="' + ref + '" t="inlineStr"' + (s ? ' s="' + s + '"' : '') + '><is><t xml:space="preserve">' + xesc(v) + '</t></is></c>';
      });
      x += '</row>';
    });
    x += '</sheetData>';
    if (sh.filter && rows.length > 1 && maxCol) x += '<autoFilter ref="A1:' + colName(maxCol - 1) + rows.length + '"/>';
    return x + '</worksheet>';
  }

  function build(sheets) {
    var files = [];
    function add(name, text) { files.push({ name: name, data: enc.encode(text) }); }
    add('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map(function (_, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') +
      '</Types>');
    add('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    add('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      sheets.map(function (s, i) { return '<sheet name="' + xesc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets></workbook>');
    add('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map(function (_, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    add('xl/styles.xml', STYLES);
    sheets.forEach(function (s, i) { add('xl/worksheets/sheet' + (i + 1) + '.xml', sheetXml(s)); });
    return zip(files);
  }

  // ---------- reader ----------
  function text(u8) { return dec.decode(u8); }
  function attr(s, name) { var m = new RegExp('\\b' + name + '="([^"]*)"').exec(s); return m ? xunesc(m[1]) : ''; }

  function readSheet(xml, shared) {
    var rows = [], rowRe = /<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g, rm;
    while ((rm = rowRe.exec(xml))) {
      var body = rm[1] || '', rowNoM = /\br="(\d+)"/.exec(rm[0].slice(0, rm[0].indexOf('>') + 1)), ri = rowNoM ? parseInt(rowNoM[1], 10) - 1 : rows.length;
      var cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, cm, row = rows[ri] || [];
      while ((cm = cellRe.exec(body))) {
        var a = cm[1], inner = cm[2] || '', ref = attr(a, 'r'), t = attr(a, 't'), val = null;
        var v = /<v>([\s\S]*?)<\/v>/.exec(inner);
        if (t === 's') { if (v) val = shared[parseInt(v[1], 10)]; if (val === undefined) val = null; }
        else if (t === 'inlineStr') { var ts = inner.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || []; val = ts.map(function (x) { return xunesc(x.replace(/<[^>]+>/g, '')); }).join(''); }
        else if (t === 'str') { val = v ? xunesc(v[1]) : null; }
        else if (t === 'b') { val = v ? (v[1] === '1' ? 1 : 0) : null; }
        else if (t === 'e') { val = null; }
        else if (v) { var n = Number(v[1]); val = isNaN(n) ? xunesc(v[1]) : n; }
        var ci = ref ? colIndex(ref) : row.length;
        while (row.length < ci) row.push(null);
        row[ci] = val;
      }
      while (rows.length < ri) rows.push([]);
      rows[ri] = row;
    }
    return rows;
  }

  function read(buf) {
    return unzip(buf).then(function (f) {
      var wb = f['xl/workbook.xml']; if (!wb) throw new Error('This is not an Excel (.xlsx) file.');
      var wbx = text(wb), rels = f['xl/_rels/workbook.xml.rels'] ? text(f['xl/_rels/workbook.xml.rels']) : '';
      var shared = [];
      if (f['xl/sharedStrings.xml']) {
        var sx = text(f['xl/sharedStrings.xml']), sre = /<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g, m;
        while ((m = sre.exec(sx))) {
          var b = (m[1] || '').replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
          var parts = b.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || [];
          shared.push(parts.map(function (x) { return xunesc(x.replace(/<[^>]+>/g, '')); }).join(''));
        }
      }
      var relMap = {}, rr = /<Relationship\b([^>]*)\/?>/g, rm2;
      while ((rm2 = rr.exec(rels))) relMap[attr(rm2[1], 'Id')] = attr(rm2[1], 'Target');
      var sheets = [], shRe = /<sheet\b([^>]*)\/?>/g, sm;
      while ((sm = shRe.exec(wbx))) {
        var rid = attr(sm[1], 'r:id') || attr(sm[1], 'id'), tgt = relMap[rid] || '';
        var path = tgt.charAt(0) === '/' ? tgt.slice(1) : 'xl/' + tgt;
        if (f[path]) sheets.push({ name: attr(sm[1], 'name'), rows: readSheet(text(f[path]), shared) });
      }
      return sheets;
    });
  }

  var api = { build: build, read: read, _crc32: crc32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GLTXlsx = api;
})(typeof window !== 'undefined' ? window : this);
