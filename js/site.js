/* SYNQ website v3 - shared helpers, theme toggle (owner: W-FOUND). Classic script, no deps. */
(function () {
  'use strict';
  var root = document.documentElement;
  var KEY = 'synq-theme';
  function T(k, p) { var I = window.SYNQ_I18N; return I ? I.t(k, p) : k; }
  root.classList.add('js');

  /* ---------- storage (always guarded) ---------- */
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  /* ---------- media query helper (old Safari uses addListener) ---------- */
  function listen(mq, fn) {
    if (!mq) return;
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  }
  function safe(fn, arg) { try { fn(arg); } catch (e) { if (window.console) console.warn('[SYNQ] listener error', e); } }

  /* ---------- reduced motion ---------- */
  var rmMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var rmFns = [];
  var SYNQ = {};
  SYNQ.reducedMotion = !!(rmMq && rmMq.matches);
  root.classList.toggle('reduced-motion', SYNQ.reducedMotion);
  listen(rmMq, function () {
    SYNQ.reducedMotion = !!rmMq.matches;
    root.classList.toggle('reduced-motion', SYNQ.reducedMotion);
    rmFns.slice().forEach(function (f) { safe(f, SYNQ.reducedMotion); });
  });
  SYNQ.onReducedMotionChange = function (fn) { if (typeof fn === 'function') rmFns.push(fn); };

  /* ---------- theme ---------- */
  var darkMq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var themeFns = [];
  function resolveTheme() {
    var t = root.getAttribute('data-theme');
    if (t === 'dark' || t === 'light') return t;
    return darkMq && darkMq.matches ? 'dark' : 'light';
  }
  function emitTheme() { var t = resolveTheme(); themeFns.slice().forEach(function (f) { safe(f, t); }); }
  SYNQ.theme = resolveTheme;
  SYNQ.onThemeChange = function (fn) { if (typeof fn === 'function') themeFns.push(fn); };
  listen(darkMq, function () {
    if (!root.getAttribute('data-theme')) { syncToggle(); emitTheme(); }
  });

  var SUN = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/></svg>';

  var toggleBtn = null;
  function syncToggle() {
    if (!toggleBtn) return;
    var dark = resolveTheme() === 'dark';
    toggleBtn.setAttribute('aria-label', dark ? T('theme.toLight') : T('theme.toDark'));
    toggleBtn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    if (toggleBtn.getAttribute('data-synq-icon') === '1') {
      toggleBtn.innerHTML = dark ? SUN : MOON;   /* icon shows the theme you switch to */
    }
  }
  function initToggle() {
    toggleBtn = document.getElementById('theme-toggle');
    if (!toggleBtn) return;
    if (!toggleBtn.querySelector('svg') && !toggleBtn.textContent.trim()) toggleBtn.setAttribute('data-synq-icon', '1');
    syncToggle();
    if (window.SYNQ_I18N) {
      window.SYNQ_I18N.whenReady(syncToggle);   /* the Arabic pack may load after this point */
      window.SYNQ_I18N.onChange(syncToggle);
    }
    toggleBtn.addEventListener('click', function () {
      var next = resolveTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      lsSet(KEY, next);
      syncToggle();
      emitTheme();
    });
  }

  /* ---------- abbr.term keyboard access ---------- */
  function initTerms() {
    var list = document.querySelectorAll('abbr.term');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      if (!el.hasAttribute('data-def') && el.getAttribute('title')) el.setAttribute('data-def', el.getAttribute('title'));
    }
  }

  /* ---------- css() ---------- */
  SYNQ.css = function (name) {
    try {
      if (name.indexOf('--') !== 0) name = '--' + name;
      return window.getComputedStyle(root).getPropertyValue(name).trim();
    } catch (e) { return ''; }
  };

  /* ---------- formatting ---------- */
  var nf0 = null;
  try { nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }); } catch (e) { nf0 = null; }
  function group(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function fixed(n, d) { return Number(n).toFixed(d); }
  function withCommas(n, d) {
    var s = fixed(Math.abs(n), d), p = s.split('.');
    return (n < 0 && Number(s) !== 0 ? '-' : '') + group(p[0]) + (p[1] ? '.' + p[1] : '');
  }
  function finite(n) { return typeof n === 'number' ? isFinite(n) : isFinite(Number(n)); }
  SYNQ.fmt = {
    int: function (n) { if (!finite(n)) return '-'; n = Math.round(Number(n)); return withCommas(n, 0); },
    pct: function (x, d) { if (!finite(x)) return '-'; d = d == null ? 1 : d; return fixed(Number(x) * 100, d) + '%'; },
    usd: function (n, d) { if (!finite(n)) return '-'; d = d == null ? 2 : d; var v = Number(n); return (v < 0 && Number(fixed(Math.abs(v), d)) !== 0 ? '-$' : '$') + withCommas(Math.abs(v), d); },
    hours: function (n) { if (!finite(n)) return '-'; return T('unit.hours', { n: withCommas(Math.round(Number(n)), 0) }); },
    clock: function (i) {
      i = Math.floor(Number(i));
      if (!isFinite(i)) return '--:--';
      var m = ((i % 48) + 48) % 48 * 30;       /* 48 half-hour intervals; interval 0 = 00:00 */
      var h = Math.floor(m / 60), mm = m % 60;
      return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
    }
  };
  void nf0;

  /* ---------- ready ---------- */
  SYNQ.ready = function (fn) {
    if (typeof fn !== 'function') return;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { safe(fn); });
    else safe(fn);
  };

  window.SYNQ = SYNQ;

  SYNQ.ready(function () {
    try { initToggle(); } catch (e) { if (window.console) console.warn('[SYNQ] theme toggle', e); }
    try { initTerms(); } catch (e) { if (window.console) console.warn('[SYNQ] terms', e); }
  });
})();
