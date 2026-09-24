/* Company codes.  Every product name starts with its company ("AJANTA - FP ASOKA"), and every company has
   a 2-3 letter code (AJN) that all of its products share.  Codes are stored in the database; this file only
   *suggests* one when a new product is added:
     - a company that already has products keeps the code they use;
     - a brand-new company gets a code made from its name (first letter + the next consonants). */
(function (root) {
  'use strict';

  function clean(s) { return String(s || '').toUpperCase().replace(/['’`.]/g, '').replace(/[^A-Z0-9]+/g, ' ').trim(); }
  function isVowel(c) { return 'AEIOU'.indexOf(c) >= 0; }

  function skeleton(word, n) {
    var out = word.charAt(0), i;
    for (i = 1; i < word.length && out.length < n; i++) if (!isVowel(word.charAt(i))) out += word.charAt(i);
    for (i = 1; i < word.length && out.length < n; i++) if (isVowel(word.charAt(i))) out += word.charAt(i);
    return out;
  }

  function companyOf(name) {
    var s = String(name || '').replace(/\s+/g, ' ').trim();
    var i = s.indexOf(' - ');
    return i < 0 ? '' : s.slice(0, i).trim();
  }

  // a code made from a company name alone
  function codeFromCompany(company) {
    var w = clean(company).replace(/[0-9]/g, '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    if (!w.length) return 'GEN';
    if (w.length === 1) return w[0].length <= 3 ? w[0] : skeleton(w[0], 3);
    var ini = w.map(function (x) { return x.charAt(0); }).join('').slice(0, 3);
    if (ini.length < 3) { var last = w[w.length - 1]; if (last.length > 1) ini += last.charAt(1); }
    return ini.slice(0, 3);
  }

  // products = the current product list (to reuse the code the company already has)
  function suggest(name, products) {
    var co = clean(companyOf(name));
    if (co && products) {
      for (var i = 0; i < products.length; i++) {
        var p = products[i];
        if (p && p.code && clean(companyOf(p.name)) === co) return String(p.code).toUpperCase();
      }
    }
    return codeFromCompany(companyOf(name) || name);
  }

  var api = { suggest: suggest, codeFromCompany: codeFromCompany, companyOf: companyOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GLTCodes = api;
})(typeof window !== 'undefined' ? window : this);
