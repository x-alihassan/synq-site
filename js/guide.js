/* SYNQ website v3 - "Sy", the flying tour guide (index.html only). Classic script, no deps.
   Lines live in js/guide-script.js (schema documented there). Styles: css/guide.css.
   How it works: an IntersectionObserver picks the section at the viewport's centre line and a
   MutationObserver follows tour.js's data-active-step, so each (section, step) maps to one beat.
   A beat = ONE slow eased flight next to the anchor (transform-only, one rAF loop that sleeps when idle),
   type 1-3 lines, draw hand-made SVG marks on the real chart (the guide stays put), optional count-up
   card / slider demo / flourish. Numbers are read from the page at runtime.
   CALM MOTION RULES (founder, 2026-10-16): a flight starts only after ~400ms of scroll stillness; it is never
   retargeted mid-flight (only the latest wanted target is queued); 1.2-1.6s ease-in-out along a gentle
   monotone arc, no overshoot/rotation, peak speed < 600px/s, long distances and the docked mobile guide
   fade-and-move instead of streaking; idle bob is 2px / 5s and OFF while flying, typing or drawing; no
   scroll-linked movement; final positions are pixel-snapped; will-change only while moving; everything stops
   when the tab is hidden.
   Modes: desktop flies; < 900px is a docked mini guide; reduced motion OR the "Motion: Off" control = static
   docked guide, full text, no typing, no drawing. Guide on/off (synq-guide) and motion (synq-guide-motion,
   default calm) persist in localStorage (try/catch). */
(function () {
  'use strict';
  var SCRIPT = window.SYNQ_GUIDE_SCRIPT;
  if (!SCRIPT || !document.getElementById('old-way') || !window.requestAnimationFrame) return;
  var KEY = 'synq-guide', MKEY = 'synq-guide-motion', CALM_MS = 400, FADE_D = 460;
  var doc = document, root = doc.documentElement;
  function lsGet() { try { return window.localStorage.getItem(KEY); } catch (e) { return null; } }
  function lsSet(v) { try { window.localStorage.setItem(KEY, v); } catch (e) { /* ignore */ } }
  function mGet() { try { return window.localStorage.getItem(MKEY); } catch (e) { return null; } }
  function mSet(v) { try { window.localStorage.setItem(MKEY, v); } catch (e) { /* ignore */ } }
  function $(s, c) { try { return (c || doc).querySelector(s); } catch (e) { return null; } }
  function $$(s, c) { try { return [].slice.call((c || doc).querySelectorAll(s)); } catch (e) { return []; } }
  function mk(tag, cls, parent, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; if (parent) parent.appendChild(e); return e; }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs, parent) { var e = doc.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { return -(Math.cos(Math.PI * t) - 1) / 2; } /* ease-in-out sine: gentle, no overshoot */
  function now() { return window.performance ? performance.now() : Date.now(); }
  function T(k, p) { return window.SYNQ_I18N ? window.SYNQ_I18N.t(k, p) : k; }
  function rtl() { return !!(window.SYNQ_I18N && window.SYNQ_I18N.isRTL()) || root.getAttribute('dir') === 'rtl'; }
  function warn(w, e) { if (window.console) console.warn('[SYNQ guide] ' + w, e); }
  var mqNarrow = window.matchMedia ? window.matchMedia('(max-width: 899px)') : { matches: false };
  function sysRM() { return !!(window.SYNQ && window.SYNQ.reducedMotion); }
  function RM() { return sysRM() || !S.calm; } /* system preference or the Motion: Off control */
  function narrow() { return mqNarrow.matches; }

  /* ---------- the character (original art; decorative) ---------- */
  var ART = '<svg class="g-svg" viewBox="0 0 120 150" focusable="false" aria-hidden="true">' +
    '<g class="g-flame"><path d="M44 129 Q51 150 58 129Z"/><path d="M62 129 Q69 150 76 129Z"/><path class="g-flame-in" d="M47.5 129 Q51 141 54.5 129Z"/><path class="g-flame-in" d="M65.5 129 Q69 141 72.5 129Z"/></g>' +
    '<g class="g-legs"><rect x="45" y="104" width="12" height="20" rx="4"/><rect x="63" y="104" width="12" height="20" rx="4"/>' +
    '<path class="g-boot" d="M42 122h17a3 3 0 0 1 3 3v4H42z"/><path class="g-boot" d="M60 122h17v7H58v-4a3 3 0 0 1 2-3z"/></g>' +
    '<g class="g-arm g-arm-r"><path class="g-sleeve" d="M80 74 L90 98"/><circle class="g-skin" cx="91" cy="101" r="5.2"/><path class="g-thumb" d="M93 97 l3 -5"/></g>' +
    '<path class="g-jacket" d="M38 71 Q60 62 82 71 L86 108 Q60 115 34 108Z"/>' +
    '<path class="g-collar" d="M51 67 L60 77 L69 67Z"/><path class="g-zip" d="M60 77 V110"/><rect class="g-badge" x="66" y="82" width="9" height="6" rx="1.5"/>' +
    '<g class="g-arm g-arm-l"><path class="g-sleeve" d="M40 74 L30 98"/><g class="g-pen"><path d="M29 101 L22 112"/><circle cx="21.6" cy="112.6" r="2.1"/></g><circle class="g-skin" cx="29" cy="101" r="5.2"/><path class="g-finger" d="M26 103 l-5 4"/></g>' +
    '<circle class="g-skin g-head" cx="60" cy="41" r="20"/>' +
    '<path class="g-hair" d="M40 39 Q39 18 60 18 Q81 18 80 37 Q73 27 59 29 Q49 30 40 39Z"/>' +
    '<g class="g-eyes"><ellipse cx="53" cy="43" rx="2.4" ry="3"/><ellipse cx="67" cy="43" rx="2.4" ry="3"/></g>' +
    '<path class="g-brow" d="M50 37.5 q3 -2 6 0 M64 37.5 q3 -2 6 0"/>' +
    '<circle class="g-cheek" cx="48.5" cy="49" r="2.6"/><circle class="g-cheek" cx="71.5" cy="49" r="2.6"/>' +
    '<path class="g-mouth g-mouth-c" d="M54.5 51.5 Q60 56.5 65.5 51.5"/><ellipse class="g-mouth g-mouth-o" cx="60" cy="53" rx="3.6" ry="3.2"/>' +
    '<path class="g-band" d="M39 41 Q38 15 60 15 Q82 15 81 41"/><rect class="g-cup" x="34.5" y="35" width="8" height="13" rx="3"/><rect class="g-cup" x="77.5" y="35" width="8" height="13" rx="3"/>' +
    '<path class="g-boom" d="M38 47 Q41 57 51 56"/><circle class="g-mic" cx="51.5" cy="56" r="2.4"/></svg>';
  var VB_W = 120, VB_H = 150, PEN = { x: 4, y: 93 }; /* pen tip in the "draw" pose, viewBox units */

  /* ---------- state ---------- */
  var S = { calm: mGet() !== 'off', lastScroll: 0, want: null, flying: false, inking: false, on: false, built: false, sec: null, step: null, key: null, beat: null, run: 0, paused: null, seen: {}, hidden: false,
    x: -200, y: 120, tx: -200, ty: 120, flip: false, timers: [], ink: [], pending: [], demo: null };
  var els = {};
  var beats = (SCRIPT.beats || []).slice();

  /* ---------- vars: every number comes from the page or the engine ---------- */
  function readVar(name) {
    var src = SCRIPT.vars && SCRIPT.vars[name];
    if (!src) return null;
    var e;
    if (src.calc) e = $('#calc-root [data-o="' + src.calc + '"]');
    else e = $$(src.sel)[src.i || 0];
    var t = e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '';
    return t && t !== '-' ? t : null;
  }
  /* line = an i18n key (guide.*). Its {vars} are read from the page; one unreadable var drops the line. */
  function fill(key) {
    var tpl = T(key), ok = true, ps = {};
    (tpl.match(/\{(\w+)\}/g) || []).forEach(function (m) { var n = m.slice(1, -1), v = readVar(n); if (v == null) ok = false; else ps[n] = v; });
    return ok ? T(key, ps) : null;
  }

  /* ---------- geometry ---------- */
  function vw() { return root.clientWidth || window.innerWidth; }
  function vh() { return window.innerHeight || root.clientHeight; }
  function headerBottom() { var h = $('.site-header'); return h ? Math.max(0, h.getBoundingClientRect().bottom) : 0; }
  function R(x, y, w, h) { return { left: x, top: y, right: x + w, bottom: y + h, width: w, height: h }; }
  function ov(a, b) { var w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return w > 0 && h > 0 ? w * h : 0; }
  var INTERACTIVE = 'a[href], button, input, select, textarea, summary, [role="button"], .sl-toggle';
  function keepOuts() {
    var V = vh(), W = vw(), hard = [], soft = [];
    hard.push(R(0, 0, W, headerBottom() + 6));
    if (els.ctl) hard.push(els.ctl.getBoundingClientRect());
    $$(INTERACTIVE).forEach(function (e) {
      if (e.closest('.g-ctl, .g-root, .site-header, .site-footer')) return;
      var r = e.getBoundingClientRect();
      if (r.width && r.bottom > 0 && r.top < V && r.right > 0 && r.left < W) hard.push(r);
    });
    $$('.step.is-active').forEach(function (s) {
      var a = s.firstElementChild, b = s.lastElementChild;
      if (!a) return;
      var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      var sr = { left: Math.min(ra.left, rb.left), right: Math.max(ra.right, rb.right), top: ra.top, bottom: rb.bottom };
      if (rb.bottom > 0 && ra.top < V) soft.push(sr, sr, sr, sr);
    });
    $$('.stage-readout, .stage-stamp, .stage-ledger dd, .callout-big, .conv-t, .rail-stats, main label, main h2, main h3, main dd').forEach(function (e) { var r = e.getBoundingClientRect(); if (r.width && r.bottom > 0 && r.top < V) soft.push(r); });
    return { hard: hard, soft: soft };
  }
  function score(r, K, extraHard, extraSoft) {
    var V = vh(), W = vw(), s = 0, hb = headerBottom();
    if (r.left < 4 || r.right > W - 4 || r.top < hb + 4 || r.bottom > V - 4) s += 1e7;
    K.hard.concat(extraHard || []).forEach(function (k) { s += ov(r, k) * 20; });
    K.soft.concat(extraSoft || []).forEach(function (k) { s += ov(r, k); });
    return s;
  }
  function fit(x, y, w, h) { var hb = headerBottom(); return { x: clamp(x, 6, vw() - w - 6), y: clamp(y, hb + 8, vh() - h - 8) }; }
  function best(cands, w, h, K, xh, xs) {
    var b = null, bs = Infinity;
    cands.forEach(function (c, i) {
      var p = fit(c[0], c[1], w, h), r = R(p.x, p.y, w, h);
      var s = score(r, K, xh, xs) + i * 40; /* earlier candidates preferred */
      if (s < bs) { bs = s; b = p; }
    });
    return b;
  }
  function actorSize() { return narrow() ? { w: 56, h: 70 } : { w: 92, h: 115 }; }
  function anchorRect(beat) {
    var a = beat && beat.anchor ? $(beat.anchor) : null;
    var r = a ? a.getBoundingClientRect() : null;
    if (!r || (!r.width && !r.height)) { var s = doc.getElementById(beat ? beat.section : ''); r = s ? s.getBoundingClientRect() : R(vw() / 2, vh() / 2, 1, 1); }
    var V = vh(), hb = headerBottom();
    /* clamp tall anchors to the visible part */
    var t = Math.max(r.top, hb), b = Math.min(r.bottom, V);
    if (b - t < 20) { t = clamp(r.top, hb, V - 20); b = t + 20; }
    return { left: r.left, right: r.right, top: t, bottom: b, width: r.width, height: b - t, el: a };
  }
  function dockPos() {
    var z = actorSize(), K = keepOuts(), V = vh(), W = vw();
    var raises = [0, Math.round(V * 0.28), Math.round(V * 0.5)];
    var c = []; raises.forEach(function (r) { c.push([rtl() ? 12 : W - z.w - 12, V - z.h - 12 - r]); });
    return best(c, z.w, z.h, K);
  }
  function targetFor(beat) {
    var z = actorSize();
    if (!beat || narrow() || RM() || S.paused === S.sec) return dockPos();
    var a = anchorRect(beat), K = keepOuts(), cy = (a.top + a.bottom) / 2 - z.h / 2;
    var stage = a.el && a.el.closest ? a.el.closest('.stage') : null;
    var c = [];
    var ar = R(a.left, a.top, a.width, a.height), soft = [ar];
    if (stage) { var sr = stage.getBoundingClientRect(), sx = rtl() ? sr.left - z.w * 0.7 : sr.right - z.w * 0.3; c.push([sx, cy], [sx, cy - 120], [sx, cy + 120], [sx, headerBottom() + 40], [sx, vh() - z.h - 40]); soft = []; }
    else c.push(rtl() ? [a.left - z.w - 10, cy] : [a.right + 10, cy], rtl() ? [a.right + 10, cy] : [a.left - z.w - 10, cy], [a.left + a.width / 2 - z.w / 2, a.top - z.h - 8], [a.left + a.width / 2 - z.w / 2, a.bottom + 8]);
    var p = best(c, z.w, z.h, K, null, soft);
    return p || dockPos();
  }

  /* ---------- one rAF loop (virtual clock: a hidden tab or a long stall never skips ahead) ---------- */
  var raf = 0, tasks = [], vt = 0, lastReal = 0;
  function loop(real) {
    raf = 0;
    if (!lastReal) lastReal = real;
    vt += Math.min(50, real - lastReal); lastReal = real;
    tasks = tasks.filter(function (f) { try { return f(vt) !== false; } catch (e) { warn('frame', e); return false; } });
    render();
    if (tasks.length && !S.hidden) raf = requestAnimationFrame(loop); else lastReal = 0;
  }
  function kick() { if (!raf && !S.hidden) { lastReal = 0; raf = requestAnimationFrame(loop); } }
  /* f(elapsedMs) -> false when finished */
  function addTask(f) { var t0 = null; tasks.push(function (t) { if (t0 == null) t0 = t; return f(t - t0); }); kick(); }
  var lastT = '';
  function render() {
    if (!els.actor) return;
    var x = S.flying ? S.x : Math.round(S.x), y = S.flying ? S.y : Math.round(S.y); /* pixel-snapped at rest */
    var t = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
    if (t !== lastT) { els.actor.style.transform = t; lastT = t; }
    placeBubble(false);
  }
  function setFlip(f) { if (S.flip !== f) { S.flip = f; els.actor.classList.toggle('is-flip', f); } }
  function faceToward(beat) {
    if (!beat || narrow() || RM()) return setFlip(false);
    var a = anchorRect(beat), z = actorSize();
    setFlip((a.left + a.right) / 2 > S.tx + z.w / 2); /* default art points left */
  }

  /* ---------- flights: one wanted target (the latest), started only after scroll stillness ---------- */
  function requestFlight(x, y, done, opts) {
    S.want = { x: Math.round(x), y: Math.round(y), done: done, opts: opts || {} };
    pumpFlight();
  }
  function pumpFlight() {
    clearTimeout(S.pumpT);
    var w = S.want;
    if (!w || S.flying) return;                                /* never retarget mid-flight: endFlight() pumps again */
    var wait = CALM_MS - (now() - S.lastScroll);
    if (w.opts.soft && (S.inking || S.drawing || S.speaking)) wait = Math.max(wait, 700); /* tidy-ups wait for the beat */
    if (wait > 0) { S.pumpT = setTimeout(pumpFlight, wait + 10); return; }
    S.want = null;
    startFlight(w.x, w.y, w.done, w.opts);
  }
  function endFlight(done) {
    S.flying = false; S.lastFlightEnd = now();
    els.actor.classList.remove('is-flying', 'is-away');
    render();
    if (done) { try { done(); } catch (e) { warn('flight done', e); } }
    pumpFlight();
  }
  function startFlight(x, y, done, opts) {
    if (window.SYNQ_GUIDE_DBG) window.SYNQ_GUIDE_DBG.push({ t: now(), ev: 'flyTo', flying: !!S.flying, x: x, y: y, sec: S.sec });
    S.tx = x; S.ty = y;
    var x0 = S.x, y0 = S.y, d = Math.hypot(x - x0, y - y0);
    if (opts.beat) faceToward(opts.beat);
    if (RM() || d < 3) { S.x = x; S.y = y; render(); if (done) done(); return; }
    S.flying = true; els.actor.classList.add('is-flying');
    if (narrow() || d > FADE_D) {                              /* fade-and-move: no streak */
      els.actor.classList.add('is-away');
      setTimeout(function () {
        S.x = x; S.y = y; render(); els.actor.classList.remove('is-away');
        setTimeout(function () { endFlight(done); }, 460);
      }, 330);
      return;
    }
    var dur = clamp(1200 + d * 0.8, 1200, 1600);              /* 1.2-1.6 s */
    var corner = y < y0 ? [x0, y] : [x, y0], mx = (x0 + x) / 2, my = (y0 + y) / 2;
    var cx = mx + (corner[0] - mx) * 0.5, cy = my + (corner[1] - my) * 0.5; /* control point inside the box: monotone, no reversal */
    addTask(function (el) {
      var p = clamp(el / dur, 0, 1), e = ease(p), u = 1 - e;
      S.x = u * u * x0 + 2 * u * e * cx + e * e * x; S.y = u * u * y0 + 2 * u * e * cy + e * e * y;
      if (p >= 1) { S.x = x; S.y = y; endFlight(done); return false; }
    });
  }

  /* ---------- bubble ---------- */
  function placeBubble(force) {
    var b = els.bubble;
    if (!b || b.hidden) return;
    var bw = b.offsetWidth, bh = b.offsetHeight, z = actorSize(), side, p;
    if (narrow() || RM() || S.paused === S.sec || !S.beat) {
      var W = vw();
      p = { x: rtl() ? 10 : Math.max(8, W - bw - 10), y: S.y - bh - 10 };
      if (p.y < headerBottom() + 8) p.y = headerBottom() + 8;
      side = 'dock';
    } else {
      if (!force && S.bpos) p = S.bpos;
      else {
        var K = force || !S.K ? (S.K = keepOuts()) : S.K, ax = S.tx, ay = S.ty;
        var a = R(ax, ay, z.w, z.h), an = anchorRect(S.beat);
        var hb = headerBottom();
        var cr = [ax + z.w + 6, ay - 6, 'r'], cl = [ax - bw - 6, ay - 6, 'l'], ct = [ax + z.w / 2 - bw / 2, ay - bh - 8, 't'], cb = [ax + z.w / 2 - bw / 2, ay + z.h + 6, 'b'];
        var c = rtl() /* RTL mirrors the preference: bubble on the guide's left first */
          ? [cl, cr, ct, cb, [ax - bw - 6, Math.max(hb + 12, ay - bh + 24), 'l'], [ax - bw - 6, hb + 14, 'l'], [ax + z.w + 6, hb + 14, 'r'], [ax - bw - 6, ay + z.h - 30, 'l']]
          : [cr, cl, ct, cb, [ax + z.w + 6, Math.max(hb + 12, ay - bh + 24), 'r'], [ax + z.w + 6, hb + 14, 'r'], [ax - bw - 6, hb + 14, 'l'], [ax + z.w + 6, ay + z.h - 30, 'r']];
        var bs = Infinity;
        c.forEach(function (cc, i) {
          var q = fit(cc[0], cc[1], bw, bh), r = R(q.x, q.y, bw, bh);
          var s = score(r, K, [a], [R(an.left, an.top, an.width, an.height)]) + i * 30 + ((cc[2] === 'r' || cc[2] === 'l') && (q.y + 26 > ay + z.h || q.y + bh < ay + 24) ? 1e5 : 0);
          if (s < bs) { bs = s; p = q; side = cc[2]; }
        });
        S.bpos = p; S.bside = side;
      }
      side = S.bside;
      p = { x: p.x + (S.x - S.tx), y: p.y + (S.y - S.ty) };
    }
    var t = 'translate3d(' + Math.round(p.x) + 'px,' + Math.round(p.y) + 'px,0)';
    if (b.style.transform !== t) b.style.transform = t;
    if (side === 'r' || side === 'l') { var ty = Math.round(clamp(S.y + z.h * 0.3 - p.y, 14, bh - 22)) + 'px'; if (b.style.getPropertyValue('--tail') !== ty) b.style.setProperty('--tail', ty); }
    if (b.getAttribute('data-side') !== side) b.setAttribute('data-side', side);
  }
  function showBubble(on) {
    els.bubble.hidden = !on;
    if (on) { S.bpos = null; placeBubble(true); }
  }

  /* ---------- timers ---------- */
  function later(fn, ms, run) { var id = setTimeout(function () { if (run === S.run) fn(); }, ms); S.timers.push(id); return id; }
  function clearTimers() { S.timers.forEach(clearTimeout); S.timers = []; }

  /* ---------- typing ---------- */
  function say(text, run, instant, done) {
    els.ghost.textContent = text; els.typed.textContent = '';
    showBubble(true);
    if (instant || RM()) { els.typed.textContent = text; if (done) later(done, 0, run); return; }
    var i = 0, ar = rtl(), units = ar ? text.split(' ') : Array.from(text); /* Arabic shaping breaks mid-word: reveal word by word */
    els.actor.classList.add('is-talk');
    (function step() {
      i = Math.min(units.length, i + (ar ? 1 : 2));
      els.typed.textContent = ar ? units.slice(0, i).join(' ') : units.slice(0, i).join('');
      if (i >= units.length) { els.actor.classList.remove('is-talk'); if (done) done(); return; }
      var ch = units[i - 1].slice(-1);
      later(step, ar ? (/[.,:;!?،؛؟]/.test(ch) ? 380 : 190) : (/[.,:;!?]/.test(ch) ? 170 : 34), run);
    })();
  }
  function sayAll(lines, run, instant, done) {
    var k = 0;
    S.speaking = true;
    if (RM() && lines.length > 1) lines = [lines.join(' ')];
    (function next() {
      if (k >= lines.length) { S.speaking = false; if (done) done(); return; }
      var line = lines[k++];
      els.dots.textContent = lines.length > 1 ? k + '/' + lines.length : '';
      say(line, run, instant, function () { if (k < lines.length) later(next, instant ? 2600 : 900 + line.length * 22, run); else next(); });
    })();
  }

  /* ---------- ink (hand-drawn marks on the real charts) ---------- */
  function jit(seed) { var s = seed; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; }; }
  function smooth(pts) {
    var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var i = 1; i < pts.length - 1; i++) {
      var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ' Q' + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1) + ' ' + mx.toFixed(1) + ' ' + my.toFixed(1);
    }
    var l = pts[pts.length - 1]; return d + ' L' + l[0].toFixed(1) + ' ' + l[1].toFixed(1);
  }
  function shapes(kind, r, from, rnd) {
    var cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2, out = [];
    if (kind === 'circle') {
      var rx = r.width / 2 + 10, ry = Math.max(14, r.height / 2 + 9), a0 = -2.3, pts = [];
      for (var i = 0; i <= 26; i++) { var a = a0 + i / 26 * (Math.PI * 2 + 0.45), k = 1 + rnd() * 0.07 + i * 0.002; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
      out.push(smooth(pts));
    } else if (kind === 'underline') {
      var y = r.bottom + 5, x0 = r.left - 3, x1 = r.right + 4;
      out.push(smooth([[x0, y + rnd() * 2], [(x0 + x1) / 2, y + 2.5 + rnd() * 2], [x1, y - 1.5]]));
      out.push(smooth([[x0 + 10, y + 5.5], [(x0 + x1) / 2, y + 7], [x1 - 14, y + 4]]));
    } else if (kind === 'tick') {
      var tx = r.right + 9, ty = cy;
      out.push('M' + (tx - 5) + ' ' + ty + ' L' + (tx) + ' ' + (ty + 6) + ' L' + (tx + 10) + ' ' + (ty - 8));
    } else if (kind === 'arrow') {
      var fx = from ? from[0] : r.right + 80, fy = from ? from[1] : cy - 40;
      var dx = cx - fx, dy = cy - fy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      var ex = cx - ux * Math.min(L * 0.25, Math.max(r.width, r.height) * 0.2), ey = cy - uy * Math.min(L * 0.25, Math.max(r.width, r.height) * 0.2);
      var sx = fx + ux * 18, sy = fy + uy * 18, mx = (sx + ex) / 2 - uy * 26, my = (sy + ey) / 2 + ux * 26;
      out.push('M' + sx.toFixed(1) + ' ' + sy.toFixed(1) + ' Q' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + ex.toFixed(1) + ' ' + ey.toFixed(1));
      var ang = Math.atan2(ey - my, ex - mx), hl = 11;
      out.push('M' + (ex - hl * Math.cos(ang - 0.5)).toFixed(1) + ' ' + (ey - hl * Math.sin(ang - 0.5)).toFixed(1) + ' L' + ex.toFixed(1) + ' ' + ey.toFixed(1) + ' L' + (ex - hl * Math.cos(ang + 0.5)).toFixed(1) + ' ' + (ey - hl * Math.sin(ang + 0.5)).toFixed(1));
    }
    return out;
  }
  /* Build one mark; returns { svg, paths, toView(x,y) } in host coordinates. */
  function mark(spec, target) {
    var host = target.closest('.stage') || doc.body, hr = host === doc.body ? null : host.getBoundingClientRect();
    var ox = hr ? hr.left + host.clientLeft : -window.pageXOffset, oy = hr ? hr.top + host.clientTop : -window.pageYOffset;
    var t = target.getBoundingClientRect();
    var r = { left: t.left - ox, right: t.right - ox, top: t.top - oy, bottom: t.bottom - oy, width: t.width, height: t.height };
    var z = actorSize(), from = [S.tx + z.w / 2 - ox, S.ty + z.h * 0.45 - oy];
    var ds = shapes(spec.kind, r, from, jit(Math.round(t.left + t.top) || 7));
    if (!ds.length) return null;
    var maxW = host === doc.body ? doc.documentElement.clientWidth : host.clientWidth;
    var svg = sv('svg', { 'class': 'g-ink', 'aria-hidden': 'true', focusable: 'false', width: maxW, height: 10 });
    var paths = ds.map(function (d) { return sv('path', { d: d, pathLength: 1 }, svg); });
    host.appendChild(svg);
    var bb; try { bb = svg.getBBox(); } catch (e) { bb = null; }
    if (bb) {
      var x0 = Math.max(0, bb.x - 6), y0 = bb.y - 6, w = Math.min(maxW - x0, bb.width + 12), h = bb.height + 12;
      svg.setAttribute('viewBox', x0 + ' ' + y0 + ' ' + w + ' ' + h); svg.setAttribute('width', w); svg.setAttribute('height', h);
      svg.style.left = x0 + 'px'; svg.style.top = y0 + 'px';
    }
    S.ink.push(svg);
    return { svg: svg, paths: paths, ox: ox, oy: oy, host: host };
  }
  function visible(el) { var r = el.getBoundingClientRect(), V = vh(); return r.width > 0 && r.top >= headerBottom() - 4 && r.bottom <= V - 4; }
  function drawMarks(beat, run, done) {
    var list = [];
    (beat.draw || []).forEach(function (d) { (d.all ? $$(d.target) : [$(d.target)]).forEach(function (t) { if (t) list.push([d, t]); }); });
    if (!list.length || RM()) { if (done) done(); return; }
    var fast = S.seen[beat._k] && !beat._replay, k = 0;
    S.drawing = true;
    els.actor.setAttribute('data-pose', 'draw');
    (function next() {
      if (run !== S.run) return;
      if (k >= list.length) { els.actor.setAttribute('data-pose', beat.pose || 'point'); S.drawing = false; if (done) done(); return; }
      var it = list[k++];
      if (!visible(it[1])) { S.pending.push(function () { if (run === S.run && visible(it[1])) { k--; next(); return true; } return false; }); return; }
      var m = mark(it[0], it[1]);
      if (!m) return next();
      var dur = fast ? 600 : it[0].kind === 'tick' ? 900 : 1600;
      S.inking = true; els.actor.classList.add('is-inking');
      addTask(function (el) {
        if (run !== S.run) return false;
        if (S.flying) return true;                             /* strokes and flights never overlap */
        var p = clamp(el / dur, 0, 1), n = m.paths.length;
        m.paths.forEach(function (pa, j) { pa.style.strokeDashoffset = (1 - clamp(p * n - j, 0, 1)).toFixed(3); });
        if (p >= 1) { S.inking = false; els.actor.classList.remove('is-inking'); later(next, 300, run); return false; }
      });
    })();
  }
  function clearInk() {
    var old = S.ink; S.ink = []; S.pending = [];
    old.forEach(function (s) { s.classList.add('is-out'); setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 450); });
  }

  /* ---------- count-up card ---------- */
  function num(t) { var m = t && t.replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; }
  function pop(beat, run, instant) {
    if (!beat.pop) { els.pop.hidden = true; return; }
    var a = readVar(beat.pop.from), b = readVar(beat.pop.to), na = num(a), nb = num(b);
    if (na == null || nb == null) { els.pop.hidden = true; return; }
    els.popLabel.textContent = (window.SYNQ_I18N ? window.SYNQ_I18N.ltr(a + ' → ' + b) : a + ' → ' + b) + ' · ' + T(beat.pop.label);
    els.pop.hidden = false; placeBubble(true);
    var dec = (b.split('.')[1] || '').replace(/\D.*/, '').length;
    function f(v) { return v.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
    if (instant || RM()) { els.popN.textContent = b; return; }
    addTask(function (el) {
      if (run !== S.run) return false;
      var p = clamp(el / 1600, 0, 1);
      els.popN.textContent = p >= 1 ? b : f(na + (nb - na) * ease(p));
      return p < 1;
    });
  }

  /* ---------- built-in actions ---------- */
  function demoSlider(beat, run, done) {
    var s = doc.getElementById('calc-shareAutomated'), out = $('#calc-root [data-o="hoursFreed"]');
    if (!s || !out) return done();
    var v0 = +s.value, mn = +s.min, mx = +s.max, v1 = v0 + 12 <= mx ? v0 + 12 : v0 - 12, h0 = out.textContent;
    var sum = doc.getElementById('calc-summary'), live = sum && sum.getAttribute('aria-live');
    function setV(v) { if (+s.value === v) return; s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); }
    function restore() { if (!S.demo || !S.demo.keep) setV(v0); if (sum && live) sum.setAttribute('aria-live', live); S.demo = null; }
    if (RM()) {
      return sayAll([T('guide.demo.rm', { hours: h0 })], run, true, done);
    }
    if (sum) sum.setAttribute('aria-live', 'off');
    S.demo = { restore: restore, el: s };
    var dur = 2400;
    els.actor.setAttribute('data-pose', 'draw');
    addTask(function (el) {
      if (run !== S.run || !S.demo) return false;
      var p = clamp(el / dur, 0, 1), v = Math.round(v0 + (v1 - v0) * ease(p));
      setV(v);
      if (p < 1) return true;
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        if (run !== S.run) return;
        var h1 = out.textContent;
        els.actor.setAttribute('data-pose', 'point');
        sayAll([T('guide.demo.1', { from: v0, to: v1, h0: h0, h1: h1 }), T('guide.demo.2', { from: v0 })], run, false, done);
        later(function () { restore(); }, 2600, run);
      }); });
      return false;
    });
  }
  function flourish(run, done) { /* calm: a longer wave in place, no looping flight */
    if (RM() || narrow()) return done();
    els.actor.setAttribute('data-pose', 'wave');
    later(done, 1800, run);
  }

  /* ---------- beats ---------- */
  function beatFor(sec, step) {
    var b = null;
    beats.forEach(function (x, i) { x._k = x._k || i + ''; if (x.section === sec && (x.step == null ? b == null : x.step === step)) b = x; });
    if (!b) beats.forEach(function (x) { if (x.section === sec && x.step == null) b = x; });
    if (!b && step != null) beats.forEach(function (x) { if (!b && x.section === sec) b = x; });
    return b;
  }
  function stopBeat() {
    S.run++; clearTimers(); S.inking = false; S.drawing = false; S.speaking = false; /* a flight in progress is never cut: it finishes, then the latest wanted target is flown */
    if (S.demo) S.demo.restore();
    els.actor.classList.remove('is-talk', 'is-inking');
    els.pop.hidden = true;
    clearInk();
  }
  function play(beat, replay) {
    if (!S.on || !beat) return;
    stopBeat();
    S.beat = beat; beat._replay = !!replay;
    var run = S.run, instant = RM() || (S.seen[beat._k] && !replay);
    var lines = (beat.lines || []).map(fill).filter(Boolean);
    els.live.textContent = lines.join(' ');
    els.actor.setAttribute('data-pose', beat.pose || 'point');
    if (S.paused === beat.section) { showBubble(false); var d = dockPos(); requestFlight(d.x, d.y); return; }
    var tp = null, stay = false;
    if (S.lastSec === beat.section && !narrow() && !RM() && S.tx > -100) { /* same chapter: one flight per chapter, stay unless the spot went bad */
      var z0 = actorSize(), r0 = R(S.tx, S.ty, z0.w, z0.h), K0 = keepOuts(), hard0 = 0;
      K0.hard.forEach(function (k) { hard0 += ov(r0, k); });
      if (r0.left >= 0 && r0.right <= vw() && r0.top >= headerBottom() && r0.bottom <= vh() && hard0 <= 500) { tp = { x: S.tx, y: S.ty }; stay = true; }
    }
    S.lastSec = beat.section;
    if (!tp) tp = targetFor(beat);
    S.home = [tp.x, tp.y];
    showBubble(false);
    S.K = null;
    var firstSeen = !S.seen[beat._k];
    S.seen[beat._k] = true;
    requestFlight(tp.x, tp.y, function () {
      if (run !== S.run) return;
      if (beat.action === 'flourish' && firstSeen) flourish(run, talk); else talk();
    }, { beat: stay ? null : beat });
    function talk() {
      if (run !== S.run) return;
      var dr = false;
      sayAll(lines, run, instant, function () {
        pop(beat, run, instant);
        if (beat.action === 'demoSlider' && (firstSeen || replay)) demoSlider(beat, run, finish); else finish();
      });
      /* start drawing once the first line is out (or the "when" condition holds) */
      function tryDraw() {
        if (dr || run !== S.run) return true;
        if (beat.when && !$(beat.when)) return false;
        dr = true; drawMarks(beat, run); return true;
      }
      later(function () { if (!tryDraw()) S.pending.push(tryDraw); }, instant ? 50 : 900, run);
    }
    function finish() { later(function () { if (!narrow() || RM()) return; showBubble(false); }, 9000, run); }
  }

  /* ---------- section / step tracking ---------- */
  var queued = 0;
  function onChange() {
    if (!S.on) return;
    clearTimeout(queued);
    queued = setTimeout(function check() {
      var still = now() - S.lastScroll;
      if (still < CALM_MS) { queued = setTimeout(check, CALM_MS - still + 10); return; } /* never start a beat mid-scroll */
      var ch = S.sec ? doc.getElementById(S.sec) : null;
      var step = ch && ch.dataset.activeStep != null ? +ch.dataset.activeStep : null;
      var b = beatFor(S.sec, step);
      var key = S.sec + ':' + (b ? b._k : '');
      if (key === S.key) return;
      if (S.paused && S.paused !== S.sec) S.paused = null;
      S.key = key;
      if (b) play(b); else { stopBeat(); showBubble(false); }
    }, RM() ? 60 : 320);
  }
  function track() {
    var ids = {}; beats.forEach(function (b) { ids[b.section] = 1; });
    var secs = Object.keys(ids).map(function (id) { return doc.getElementById(id); }).filter(Boolean);
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { S.sec = e.target.id; onChange(); } });
    }, { rootMargin: '-50% 0px -49% 0px' });
    secs.forEach(function (s) { io.observe(s); });
    var mo = new MutationObserver(function (ms) { ms.forEach(function (m) { if (m.target.id === S.sec) onChange(); }); });
    $$('.chapter').forEach(function (c) { mo.observe(c, { attributes: true, attributeFilter: ['data-active-step'] }); });
  }

  /* ---------- scroll / resize: keep clear of controls, follow anchors ---------- */
  var sq = 0;
  /* After scroll stillness only: keep the guide where it is unless it is off-screen or sits on a control. */
  function reflow(force) {
    sq = 0;
    if (!S.on || S.hidden) return;
    S.pending = S.pending.filter(function (f) { return !f(); });
    placeCtl();
    if (S.flying || S.demo) return;
    var t = S.beat ? targetFor(S.beat) : dockPos();
    S.home = [t.x, t.y];
    var z = actorSize(), r = R(S.x, S.y, z.w, z.h), K = keepOuts(), hard = 0;
    K.hard.forEach(function (k) { hard += ov(r, k); });
    var off = r.left < 0 || r.right > vw() || r.top < headerBottom() || r.bottom > vh();
    var far = Math.hypot(t.x - S.tx, t.y - S.ty) > 8;
    if (far && (force || off || hard > 500) && (force || now() - (S.lastFlightEnd || 0) > 3000)) {
      requestFlight(t.x, t.y, function () { S.K = null; S.bpos = null; placeBubble(true); }, { soft: true, beat: S.beat });
    } else if (force) { S.K = null; S.bpos = null; placeBubble(true); }
  }
  function onScroll() { S.lastScroll = now(); clearTimeout(sq); sq = setTimeout(reflow, CALM_MS + 60); }
  var ctlRaise = -1;
  function placeCtl() {
    var c = els.ctl; if (!c) return;
    var V = vh(), raises = [0, Math.round(V * 0.28), Math.round(V * 0.5)], K = { hard: [], soft: [] };
    $$(INTERACTIVE).forEach(function (e) {
      if (e.closest('.g-ctl, .g-root, .site-header')) return;
      var r = e.getBoundingClientRect(); if (r.width && r.bottom > V * 0.4 && r.top < V) K.hard.push(r);
    });
    var base = c.getBoundingClientRect(), cur = ctlRaise < 0 ? 0 : ctlRaise, pick = raises[raises.length - 1];
    for (var i = 0; i < raises.length; i++) {
      var dy = raises[i] - cur, r = R(base.left, base.top - dy, base.width, base.height);
      if (!K.hard.some(function (k) { return ov(r, k) > 0; })) { pick = raises[i]; break; }
    }
    if (pick !== ctlRaise) { ctlRaise = pick; c.style.transform = pick ? 'translate3d(0,' + (-pick) + 'px,0)' : ''; }
  }

  /* ---------- pause on visitor input ---------- */
  function onUser(e) {
    if (!S.on || !e.isTrusted) return;
    var t = e.target;
    if (!t || !t.closest || !t.closest('#sim-root, #calc-root, .sl-toggle, details.data-table')) return;
    if (S.demo && t === S.demo.el) S.demo.keep = true; /* the visitor's own value wins */
    if (S.paused === S.sec) return;
    S.paused = S.sec;
    stopBeat(); showBubble(false);
    els.actor.setAttribute('data-pose', 'idle');
    var d = dockPos(); requestFlight(d.x, d.y);
  }

  /* ---------- on / off ---------- */
  function setOn(on, user) {
    S.on = on;
    if (user) lsSet(on ? 'on' : 'off');
    els.toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    paintUI();
    els.replay.hidden = els.skip.hidden = els.motion.hidden = !on;
    root.classList.toggle('g-on', on);
    root.classList.toggle('g-motion-off', RM());
    if (!on && !S.built) return;
    if (!on) { stopBeat(); showBubble(false); els.live.textContent = ''; els.root.hidden = true; S.key = null; S.beat = null; return; }
    if (!S.built) build();
    els.root.hidden = false;
    var d = dockPos();
    if (S.x < -100) { /* first appearance: fade in at the dock, no entrance flight */
      S.x = d.x; S.y = d.y; S.tx = d.x; S.ty = d.y;
      els.actor.classList.add('is-away'); render();
      setTimeout(function () { els.actor.classList.remove('is-away'); }, 60);
    }
    S.key = null; onChange();
    placeCtl();
  }
  function build() {
    S.built = true;
    var r = mk('div', 'g-root', doc.body); r.hidden = true; els.root = r;
    var a = mk('div', 'g-actor', r); a.setAttribute('aria-hidden', 'true'); a.setAttribute('data-pose', 'wave');
    var bob = mk('div', 'g-bob', a); bob.innerHTML = ART; els.actor = a;
    var b = mk('div', 'g-bubble', r); b.hidden = true; els.bubble = b;
    var nm = mk('p', 'g-name', b); nm.setAttribute('aria-hidden', 'true');
    els.badge = mk('span', null, nm); els.dots = mk('span', 'g-dots', nm);
    var tx = mk('p', 'g-text', b); tx.setAttribute('aria-hidden', 'true');
    els.ghost = mk('span', 'g-ghost', tx); els.typed = mk('span', 'g-typed', tx);
    var p = mk('div', 'g-pop', b); p.hidden = true; p.setAttribute('aria-hidden', 'true');
    els.popN = mk('span', 'g-pop-n num', p); els.popLabel = mk('span', 'g-pop-l', p); els.pop = p;
    var x = mk('button', 'g-close', b, '×'); x.type = 'button'; els.close = x;
    x.addEventListener('click', function () { showBubble(false); });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { S.bpos = null; clearTimeout(sq); sq = setTimeout(function () { reflow(true); }, 400); }, { passive: true });
    ['pointerdown', 'keydown', 'focusin', 'input'].forEach(function (ev) { doc.addEventListener(ev, onUser, true); });
    doc.addEventListener('visibilitychange', function () {
      S.hidden = doc.hidden; root.classList.toggle('g-paused', doc.hidden);
      if (doc.hidden) { if (els.actor.classList.contains('is-talk')) { els.typed.textContent = els.ghost.textContent; els.actor.classList.remove('is-talk'); } }
      else kick();
    });
    if (window.SYNQ && window.SYNQ.onReducedMotionChange) window.SYNQ.onReducedMotionChange(function () { paintMotion(); S.key = null; onChange(); });
    if (mqNarrow.addEventListener) mqNarrow.addEventListener('change', function () { S.key = null; onChange(); });
    track();
    paintUI();
  }
  function controls() {
    var c = mk('div', 'g-ctl'); c.setAttribute('role', 'group'); els.ctl = c;
    var t = mk('button', 'g-btn g-toggle', c); t.type = 'button'; t.setAttribute('aria-pressed', 'false');
    mk('span', 'g-face', t).setAttribute('aria-hidden', 'true');
    els.toggleTxt = mk('span', null, t); els.toggle = t;
    var rp = mk('button', 'g-btn', c); rp.type = 'button';
    mk('span', null, rp, '↺').setAttribute('aria-hidden', 'true'); els.replayLbl = mk('span', 'g-lbl', rp); els.replay = rp;
    var sk = mk('button', 'g-btn', c); sk.type = 'button';
    els.skipLbl = mk('span', 'g-lbl', sk); mk('span', null, sk, '›').setAttribute('aria-hidden', 'true'); els.skip = sk;
    var mo = mk('button', 'g-btn g-motion', c); mo.type = 'button'; els.motion = mo; els.motionIco = mk('span', null, mo); els.motionIco.setAttribute('aria-hidden', 'true');
    els.motionTxt = mk('span', 'g-lbl', mo); mo.hidden = true;
    mo.addEventListener('click', function () { if (!sysRM()) setMotion(!S.calm, true); });
    var live = mk('p', 'visually-hidden'); live.setAttribute('aria-live', 'polite'); els.live = live;
    var hdr = $('.site-header');
    if (hdr && hdr.parentNode) { hdr.parentNode.insertBefore(c, hdr.nextSibling); hdr.parentNode.insertBefore(live, c.nextSibling); }
    else { doc.body.appendChild(c); doc.body.appendChild(live); }
    t.addEventListener('click', function () { setOn(!S.on, true); });
    rp.addEventListener('click', function () {
      if (!S.on) return;
      S.paused = null;
      var ch = S.sec ? doc.getElementById(S.sec) : null, step = ch && ch.dataset.activeStep != null ? +ch.dataset.activeStep : null;
      var b = beatFor(S.sec, step); if (b) { S.key = S.sec + ':' + b._k; play(b, true); }
    });
    sk.addEventListener('click', function () {
      if (!S.on) return;
      S.paused = S.sec; stopBeat(); showBubble(false); els.live.textContent = T('guide.ui.skipped');
      els.actor.setAttribute('data-pose', 'idle'); var d = dockPos(); requestFlight(d.x, d.y);
    });
  }

  /* Motion: Calm (default) | Off. Off behaves exactly like prefers-reduced-motion. */
  /* every visible/aria string of the guide UI; called on build and on a live language switch */
  function paintUI() {
    if (!els.ctl) return;
    els.ctl.setAttribute('aria-label', T('guide.ui.group'));
    els.toggle.setAttribute('aria-label', T('guide.ui.toggle')); els.toggle.title = T('guide.ui.toggleTitle');
    els.toggleTxt.textContent = S.on ? T('guide.ui.on') : T('guide.ui.off');
    els.replay.setAttribute('aria-label', T('guide.ui.replayAria')); els.replay.title = T('guide.ui.replayTitle'); els.replayLbl.textContent = T('guide.ui.replay');
    els.skip.setAttribute('aria-label', T('guide.ui.skipAria')); els.skip.title = T('guide.ui.skipTitle'); els.skipLbl.textContent = T('guide.ui.skip');
    if (els.badge) els.badge.textContent = T('guide.badge', { name: T('guide.name') });
    if (els.close) els.close.setAttribute('aria-label', T('guide.ui.close'));
    paintMotion();
  }
  function paintMotion() {
    var off = RM(), sys = sysRM();
    els.motionIco.textContent = off ? '=' : '\u2248';
    els.motionTxt.textContent = off ? T('guide.motion.off') : T('guide.motion.calm');
    els.motion.setAttribute('aria-pressed', off ? 'true' : 'false');
    els.motion.setAttribute('aria-label', sys ? T('guide.motion.ariaSys') : off ? T('guide.motion.ariaOff') : T('guide.motion.ariaCalm'));
    els.motion.title = sys ? T('guide.motion.titleSys') : off ? T('guide.motion.titleOff') : T('guide.motion.titleCalm');
    els.motion.disabled = sys;
    root.classList.toggle('g-motion-off', off);
  }
  function setMotion(calm, user) {
    S.calm = calm; if (user) mSet(calm ? 'calm' : 'off');
    paintMotion();
    if (!S.on) return;
    S.key = null; onChange();
  }
  function langChanged() { /* close the bubble, repaint the UI, restart the current beat in the new language (text instant: already seen) */
    if (!S.built) { paintUI(); return; }
    stopBeat(); showBubble(false); paintUI(); S.bpos = null; S.K = null;
    if (S.on) { S.key = null; onChange(); }
  }
  function init() {
    try {
      controls(); paintUI();
      if (window.SYNQ_I18N) window.SYNQ_I18N.onChange(langChanged);
      var pref = lsGet(), on = pref ? pref === 'on' : !narrow();
      var go = function () { try { setOn(on, false); } catch (e) { warn('start', e); } };
      if (!on) return setOn(false, false);
      if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 1500 }); else setTimeout(go, 300);
    } catch (e) { warn('init', e); }
  }
  /* small public hook for QA / the founder's console */
  window.SYNQ_GUIDE = { motion: function (m) { if (m === 'off' || m === 'calm') setMotion(m === 'calm', true); return RM() ? 'off' : 'calm'; }, on: function () { setOn(true, true); }, off: function () { setOn(false, true); }, state: function () { return { on: S.on, sec: S.sec, beat: S.beat && S.beat._k, paused: S.paused }; } };
  function boot() { if (window.SYNQ_I18N) window.SYNQ_I18N.whenReady(init); else init(); } /* Arabic pages load their pack asynchronously */
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})();
