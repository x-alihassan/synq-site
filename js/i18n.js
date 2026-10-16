/* SYNQ website v3 - language runtime (EN | العربية). Classic script, no deps, no build.
   Load order (every page, <head>):
     1. inline "language pre-paint" script: picks the language (?lang= > saved choice > browser 'ar*' on
        first visit > en), sets <html lang dir>, hides the body (html.i18n-wait) while Arabic loads, and
        starts loading the Arabic font + js/i18n-ar.js. English pages never download either.
     2. <script defer src="js/i18n-en.js">  EN source for every JS-built string (window.SYNQ_I18N_PACKS.en)
     3. <script defer src="js/i18n.js">     this file: window.SYNQ_I18N
   Static text: data-i18n="key" (innerHTML) and data-i18n-attr="attr:key;attr2:key2". The HTML itself is
   the English source of static keys (cached on first apply, restored when switching back).
   JS-built text: SYNQ_I18N.t(key, params). Missing key -> English -> the key itself (warned once).
   Modules that build DOM: SYNQ_I18N.whenReady(fn) instead of DOMContentLoaded (waits for the Arabic pack
   on Arabic pages, so nothing renders twice) and SYNQ_I18N.onChange(fn) to re-render on a live switch.
   Arabic strings may mark Latin runs as [[SLA 80/20]]: t() turns that into a Unicode isolate (FSI..PDI)
   so mixed text keeps its order; params are isolated the same way in Arabic. */
(function () {
  'use strict';
  var root = document.documentElement;
  var KEY = 'synq-lang';
  var LANGS = { en: { dir: 'ltr', label: 'English', short: 'EN' }, ar: { dir: 'rtl', label: 'العربية', short: 'عربي' } };
  var FONT_AR = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap';
  var PACKS = window.SYNQ_I18N_PACKS = window.SYNQ_I18N_PACKS || {};
  var FSI = '⁨', PDI = '⁩';

  function lsGet() { try { return window.localStorage.getItem(KEY); } catch (e) { return null; } }
  function lsSet(v) { try { window.localStorage.setItem(KEY, v); return true; } catch (e) { return false; } }
  var canStore = (function () { try { var k = '__synq_t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; } })();

  var lang = root.getAttribute('lang') === 'ar' ? 'ar' : 'en';
  var warned = {};
  var changeFns = [], readyFns = [], packWaiters = {};
  var domReady = document.readyState !== 'loading';
  var applied = false;

  function warn(k) { if (!warned[k]) { warned[k] = 1; if (window.console) console.warn('[SYNQ i18n] missing key', k); } }
  function isolate(s) { return FSI + s + PDI; }
  function marks(s) { return lang === 'ar' ? s.replace(/\[\[([\s\S]*?)\]\]/g, function (_, x) { return isolate(x); }) : s.replace(/\[\[([\s\S]*?)\]\]/g, '$1'); }

  /* t('key', {n: 5}) -> string. Params: {name}. In Arabic every param value is wrapped in an isolate. */
  function lookup(key, l) {
    var p = PACKS[l || lang];
    if (p && Object.prototype.hasOwnProperty.call(p, key)) return p[key];
    return null;
  }
  function has(key) { return lookup(key, lang) != null || lookup(key, 'en') != null; }
  function t(key, params) {
    var s = lookup(key, lang);
    if (s == null && lang !== 'en') s = lookup(key, 'en');
    if (s == null) { warn(key); s = key; }
    s = marks(String(s));
    if (params) {
      s = s.replace(/\{(\w+)\}/g, function (m, name) {
        if (!Object.prototype.hasOwnProperty.call(params, name)) return m;
        var v = String(params[name]);
        return lang === 'ar' ? isolate(v) : v;
      });
    }
    return s;
  }
  /* wrap a Latin/number token for Arabic text (no-op in English) */
  function ltr(s) { return lang === 'ar' ? isolate(String(s)) : String(s); }

  /* ---------- static apply ---------- */
  function initTerms(scope) {
    var list = scope.querySelectorAll ? scope.querySelectorAll('abbr.term') : [];
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (!a.hasAttribute('tabindex')) a.setAttribute('tabindex', '0');
      if (a.getAttribute('title')) a.setAttribute('data-def', a.getAttribute('title'));
    }
  }
  function applyEl(el) {
    var k = el.getAttribute('data-i18n');
    if (k) {
      if (el.__i18nEn == null) el.__i18nEn = el.innerHTML;
      var v = lang === 'en' ? null : lookup(k, lang);
      if (v == null && lang !== 'en') warn(k);
      var html = v == null ? el.__i18nEn : marks(v);
      if (el.tagName === 'TITLE') { if (document.title !== html) document.title = html.replace(/&amp;/g, '&'); }
      else if (el.innerHTML !== html) { el.innerHTML = html; initTerms(el); }
    }
    var spec = el.getAttribute('data-i18n-attr');
    if (spec) {
      spec.split(';').forEach(function (pair) {
        var p = pair.split(':'); if (p.length < 2) return;
        var attr = p[0].trim(), key = p.slice(1).join(':').trim();
        var store = el.__i18nAttr || (el.__i18nAttr = {});
        if (!(attr in store)) store[attr] = el.getAttribute(attr);
        var v = lang === 'en' ? null : lookup(key, lang);
        if (v == null && lang !== 'en') warn(key);
        var val = v == null ? store[attr] : marks(v);
        if (val == null) el.removeAttribute(attr); else if (el.getAttribute(attr) !== val) el.setAttribute(attr, val);
        if (attr === 'title' && el.matches && el.matches('abbr.term')) el.setAttribute('data-def', val || '');
      });
    }
  }
  function apply(scope) {
    scope = scope || document;
    var list = scope.querySelectorAll('[data-i18n],[data-i18n-attr]');
    for (var i = 0; i < list.length; i++) { try { applyEl(list[i]); } catch (e) { if (window.console) console.warn('[SYNQ i18n] apply', e); } }
  }

  /* ---------- pack loading ---------- */
  function ensurePack(l, cb) {
    if (l === 'en' || PACKS[l]) { cb(true); return; }
    (packWaiters[l] = packWaiters[l] || []).push(cb);
    setTimeout(function () { if (!PACKS[l]) packLoaded(l, false); }, 4000);   /* offline: fall back to English */
    if (window.__synqPackFail === l) { packLoaded(l, false); return; }
    if (document.getElementById('synq-pack-' + l)) return;   /* already requested (pre-paint script) */
    var s = document.createElement('script');
    s.id = 'synq-pack-' + l; s.src = 'js/i18n-' + l + '.js'; s.async = true;
    s.onerror = function () { packLoaded(l, false); };
    document.head.appendChild(s);
  }
  function packLoaded(l, ok) {
    var w = packWaiters[l] || []; packWaiters[l] = [];
    w.forEach(function (cb) { try { cb(ok !== false && !!PACKS[l]); } catch (e) { if (window.console) console.warn(e); } });
  }
  function ensureFont(l) {
    if (l !== 'ar' || document.getElementById('synq-font-ar')) return;
    var f = document.createElement('link');
    f.id = 'synq-font-ar'; f.rel = 'stylesheet'; f.href = FONT_AR;
    document.head.appendChild(f);
  }

  /* ---------- switcher (injected next to the theme toggle) ---------- */
  var sw = null, live = null;
  function buildSwitch() {
    var anchor = document.getElementById('theme-toggle');
    if (!anchor || document.getElementById('lang-switch')) return;
    sw = document.createElement('div');
    sw.id = 'lang-switch';
    sw.className = 'lang-switch';
    sw.setAttribute('role', 'group');
    ['en', 'ar'].forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'lang-btn';
      b.setAttribute('data-lang', l);
      b.setAttribute('lang', l);
      b.setAttribute('dir', LANGS[l].dir);
      b.innerHTML = '<span class="lang-long">' + LANGS[l].label + '</span><span class="lang-short" aria-hidden="true">' + LANGS[l].short + '</span>';
      b.addEventListener('click', function () { setLang(l, { user: true }); });
      sw.appendChild(b);
    });
    sw.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k !== 'ArrowLeft' && k !== 'ArrowRight') return;
      var btns = sw.querySelectorAll('button');
      var i = [].indexOf.call(btns, document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      btns[(i + 1) % 2].focus();
    });
    anchor.parentNode.insertBefore(sw, anchor);
    live = document.createElement('div');
    live.className = 'visually-hidden';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('role', 'status');
    document.body.appendChild(live);
    syncSwitch();
  }
  function syncSwitch() {
    if (!sw) return;
    sw.setAttribute('aria-label', t('lang.group'));
    [].forEach.call(sw.querySelectorAll('button'), function (b) {
      var on = b.getAttribute('data-lang') === lang;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('aria-label', b.getAttribute('data-lang') === 'ar' ? 'العربية (Arabic)' : 'English (الإنجليزية)');
    });
  }

  /* keep the language on internal links when the browser blocks storage */
  function linkCarry(e) {
    if (canStore || lang === 'en') return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    try {
      var u = new URL(a.getAttribute('href'), location.href);
      if (u.origin !== location.origin || !/\.html$|\/$/.test(u.pathname)) return;
      u.searchParams.set('lang', lang);
      a.setAttribute('href', u.pathname.split('/').pop() + u.search + u.hash);
    } catch (err) { /* ignore */ }
  }

  function syncUrl() {
    try {
      var u = new URL(location.href);
      if (!u.searchParams.has('lang')) return;
      u.searchParams.set('lang', lang);
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    } catch (e) { /* file:// or old browser */ }
  }

  function setDocLang(l) {
    root.setAttribute('lang', l);
    root.setAttribute('dir', LANGS[l].dir);
  }

  function emit() { changeFns.slice().forEach(function (f) { try { f(lang); } catch (e) { if (window.console) console.warn('[SYNQ i18n] listener', e); } }); }

  function setLang(l, opts) {
    opts = opts || {};
    if (!LANGS[l]) l = 'en';
    if (opts.user) { lsSet(l); }
    if (l === lang && applied) { syncSwitch(); return; }
    ensureFont(l);
    ensurePack(l, function (ok) {
      if (!ok) l = 'en';
      lang = l;
      setDocLang(l);
      apply(document);
      syncSwitch();
      syncUrl();
      emit();
      if (live && opts.user) live.textContent = l === 'ar' ? 'تم التبديل إلى العربية' : 'Switched to English';
    });
  }

  function reveal() { root.classList.remove('i18n-wait'); }

  function whenReady(fn) {
    if (typeof fn !== 'function') return;
    if (applied) { try { fn(); } catch (e) { if (window.console) console.warn(e); } return; }
    readyFns.push(fn);
  }

  function boot() {
    buildSwitch();
    document.addEventListener('click', linkCarry, true);
    ensurePack(lang, function (ok) {
      if (!ok) { lang = 'en'; setDocLang('en'); }
      apply(document);
      syncSwitch();
      applied = true;
      var fns = readyFns; readyFns = [];
      fns.forEach(function (f) { try { f(); } catch (e) { if (window.console) console.warn('[SYNQ i18n] ready fn', e); } });
      requestAnimationFrame(reveal);
    });
  }

  window.SYNQ_I18N = {
    t: t, has: has, ltr: ltr, lang: function () { return lang; }, dir: function () { return LANGS[lang].dir; },
    isRTL: function () { return lang === 'ar'; },
    setLang: setLang, apply: apply, onChange: function (fn) { if (typeof fn === 'function') changeFns.push(fn); },
    whenReady: whenReady,
    _packLoaded: packLoaded
  };
  if (PACKS.ar) packLoaded('ar', true);

  if (domReady) boot(); else document.addEventListener('DOMContentLoaded', boot);
  /* safety: never leave the page hidden */
  setTimeout(reveal, 3000);
})();
