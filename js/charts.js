/*!
 * SYNQ charts — tiny hand-rolled SVG primitives (window.SynqCharts).
 * Every colour comes from CSS custom properties via classes (see css/tour.css),
 * so the theme toggle needs no re-render. Updates change attributes/classes;
 * motion uses transform / opacity / stroke-dashoffset only.
 * One shared rAF loop (SynqCharts.loop) drives tweens, springs and the tour.
 */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var uidN = 0;

  function uid(p) { uidN += 1; return (p || 'sc') + uidN; }

  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function h(tag, cls, parent, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  function T(k, p) { var I = window.SYNQ_I18N; return I ? I.t(k, p) : k; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function r1(v) { return Math.round(v * 10) / 10; }

  /* ---------- formatting (falls back when window.SYNQ is absent) ---------- */
  function S() { return window.SYNQ || null; }
  var fmt = {
    int: function (n) { var s = S(); return s && s.fmt ? s.fmt.int(n) : Math.round(n).toLocaleString('en-US'); },
    pct: function (x, d) {
      var s = S(); if (s && s.fmt) return s.fmt.pct(x, d == null ? 1 : d);
      return (x * 100).toFixed(d == null ? 1 : d) + '%';
    },
    usd: function (n, d) { var s = S(); return s && s.fmt ? s.fmt.usd(n, d == null ? 2 : d) : '$' + n.toFixed(d == null ? 2 : d); },
    clock: function (i) {
      var s = S(); if (s && s.fmt && s.fmt.clock) return s.fmt.clock(i);
      var m = i * 30; return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2);
    }
  };

  /* ---------- reduced motion (live) ---------- */
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() {
    var s = S();
    if (s && typeof s.reducedMotion === 'boolean') return s.reducedMotion;
    return !!(mq && mq.matches);
  }
  function onReduced(fn) {
    var s = S();
    if (s && s.onReducedMotionChange) { s.onReducedMotionChange(function () { fn(reduced()); }); return; }
    if (mq) {
      var cb = function () { fn(reduced()); };
      if (mq.addEventListener) mq.addEventListener('change', cb); else if (mq.addListener) mq.addListener(cb);
    }
  }

  /* ---------- the one rAF loop ---------- */
  // A task returns true to stay scheduled. Tasks added mid-frame run next frame.
  var tasks = [], pending = [], running = false;
  function frameFn(t) {
    var cur = tasks.concat(pending); tasks = []; pending = [];
    for (var i = 0; i < cur.length; i++) {
      var alive = false;
      try { alive = cur[i](t) === true; } catch (e) { if (window.console) console.warn('[SynqCharts] task', e); }
      if (alive) tasks.push(cur[i]);
    }
    if (tasks.length || pending.length) requestAnimationFrame(frameFn); else running = false;
  }
  function addTask(fn) {
    pending.push(fn);
    if (!running) { running = true; requestAnimationFrame(frameFn); }
  }
  var loop = { add: addTask };

  /* Spring-ish value: eases towards target each frame; snaps under reduced motion. */
  function Value(initial, onChange, k) {
    var v = { cur: initial, target: initial, k: k || 0.16, active: false };
    function step() {
      var d = v.target - v.cur;
      if (Math.abs(d) < 0.001) { v.cur = v.target; onChange(v.cur); v.active = false; return false; }
      v.cur += d * v.k; onChange(v.cur); return true;
    }
    v.to = function (t) {
      if (t === v.target && !v.active) return;
      v.target = t;
      if (reduced()) { v.cur = t; onChange(t); return; }
      if (!v.active) { v.active = true; addTask(step); }
    };
    v.set = function (t) { v.target = t; v.cur = t; onChange(t); };
    onChange(initial);
    return v;
  }

  /* Count-up on a text node. */
  function countUp(el, from, to, opts) {
    opts = opts || {};
    var f = opts.format || function (n) { return fmt.int(n); };
    var dur = opts.duration || 900;
    if (el._cu) el._cu.cancel = true;
    if (reduced() || dur <= 0) { el.textContent = f(to); return; }
    var job = { cancel: false }; el._cu = job;
    var t0 = null;
    addTask(function (t) {
      if (job.cancel) return false;
      if (t0 == null) t0 = t;
      var p = clamp((t - t0) / dur, 0, 1);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = f(from + (to - from) * e);
      return p < 1;
    });
  }

  /* ---------- frame / scales ---------- */
  function frame(parent, o) {
    o = o || {};
    var w = Math.max(120, Math.round(o.w)), hgt = Math.max(80, Math.round(o.h));
    var pad = o.pad || { t: 12, r: 8, b: 22, l: 30 };
    var n = o.n || 48;
    var svg = svgEl('svg', {
      'class': 'sc-svg' + (o.cls ? ' ' + o.cls : ''), viewBox: '0 0 ' + w + ' ' + hgt,
      width: w, height: hgt, focusable: 'false', 'aria-hidden': 'true'
    }, parent);
    var id = uid('sc');
    var defs = svgEl('defs', null, svg);
    hatch(defs, id + '-hatch', 'sc-hatch-line');
    hatch(defs, id + '-hatch-alert', 'sc-hatch-line sc-hatch-line--alert');
    hatch(defs, id + '-hatch-sage', 'sc-hatch-line sc-hatch-line--sage');
    var pw = w - pad.l - pad.r, ph = hgt - pad.t - pad.b;
    var slot = pw / n;
    var F = {
      svg: svg, defs: defs, id: id, w: w, h: hgt, pad: pad, pw: pw, ph: ph, n: n, slot: slot,
      gap: o.gap != null ? o.gap : (slot > 9 ? 2 : slot > 5 ? 1 : 0.6),
      base: pad.t + ph,
      x: function (i) { return pad.l + i * slot; },
      cx: function (i) { return pad.l + (i + 0.5) * slot; },
      scale: function (max) { return function (v) { return pad.t + ph - (clamp(v, 0, max) / max) * ph; }; },
      url: function (name) { return 'url(#' + id + '-' + name + ')'; }
    };
    F.bw = Math.max(0.8, slot - F.gap);
    return F;
  }

  function hatch(defs, id, cls) {
    var p = svgEl('pattern', { id: id, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 6, 'class': cls }, p);
    return p;
  }

  function group(F, cls, parent) { return svgEl('g', { 'class': cls || null }, parent || F.svg); }

  /* y gridlines + labels */
  function yAxis(F, ticks, y, label, cls) {
    var g = group(F, 'sc-axis ' + (cls || ''));
    ticks.forEach(function (t) {
      var yy = r1(y(t));
      svgEl('line', { x1: F.pad.l, x2: F.w - F.pad.r, y1: yy, y2: yy, 'class': t === 0 ? 'sc-base' : 'sc-grid' }, g);
      var tx = svgEl('text', { x: F.pad.l - 6, y: yy + 3.5, 'class': 'sc-tick', 'text-anchor': 'end' }, g);
      tx.textContent = fmt.int(t);
    });
    if (label) {
      var lt = svgEl('text', { x: F.pad.l, y: F.pad.t - 3, 'class': 'sc-unit' }, g);
      lt.textContent = label;
    }
    return g;
  }

  function xAxis(F, every) {
    var g = group(F, 'sc-axis sc-xaxis');
    for (var i = 0; i < F.n; i += every) {
      var t = svgEl('text', { x: r1(F.x(i)), y: F.h - 6, 'class': 'sc-tick', 'text-anchor': i === 0 ? 'start' : 'middle' }, g);
      t.textContent = fmt.clock(i);
    }
    return g;
  }

  /* bars: one rect per interval, grow via CSS transform (scaleY from the base) */
  function bars(F, values, y, cls, parent) {
    var g = group(F, 'sc-bars ' + (cls || ''), parent);
    var rects = values.map(function (v, i) {
      var top = y(v || 0);
      var r = svgEl('rect', {
        x: r1(F.x(i) + F.gap / 2), y: r1(top), width: r1(F.bw), height: r1(Math.max(0, F.base - top)), 'class': 'sc-bar'
      }, g);
      r.style.transitionDelay = (i * 9) + 'ms';
      return r;
    });
    return { g: g, rects: rects, reveal: revealer(rects) };
  }

  /* stacked: series[k][i], bottom to top */
  function stack(F, series, y, classes, parent) {
    var g = group(F, 'sc-stack', parent);
    var layers = series.map(function (_, k) { return group(F, 'sc-bars ' + (classes[k] || ''), g); });
    var rectsBy = series.map(function () { return []; });
    for (var i = 0; i < F.n; i++) {
      var acc = 0;
      for (var k = 0; k < series.length; k++) {
        var v = series[k][i] || 0;
        var y0 = y(acc), y1 = y(acc + v);
        var cl = classes[k] || '';
        var hatchFill = cl.indexOf('is-hatch') !== -1;
        var r = svgEl('rect', {
          x: r1(F.x(i) + F.gap / 2), y: r1(y1), width: r1(F.bw), height: r1(Math.max(0, y0 - y1)), 'class': 'sc-bar',
          fill: hatchFill ? F.url('hatch-sage') : null
        }, layers[k]);
        r.style.transitionDelay = (i * 9 + k * 60) + 'ms';
        rectsBy[k].push(r);
        acc += v;
      }
    }
    return { g: g, layers: layers, rects: rectsBy, reveal: rectsBy.map(revealer) };
  }

  function revealer(rects) {
    var last = -1;
    return function (upto) {
      upto = clamp(Math.round(upto), 0, rects.length);
      if (upto === last) return;
      for (var i = 0; i < rects.length; i++) {
        var on = i < upto;
        if (on !== rects[i].classList.contains('is-in')) rects[i].classList.toggle('is-in', on);
      }
      last = upto;
    };
  }

  function linePath(F, values, y) {
    var d = '', pen = false;
    for (var i = 0; i < values.length; i++) {
      if (values[i] == null) { pen = false; continue; }
      d += (pen ? 'L' : 'M') + r1(F.cx(i)) + ' ' + r1(y(values[i]));
      pen = true;
    }
    return d;
  }

  function stepPath(F, values, y, close) {
    var d = 'M' + r1(F.x(0)) + ' ' + r1(y(values[0]));
    for (var i = 0; i < values.length; i++) {
      var yy = r1(y(values[i]));
      if (i > 0) d += 'V' + yy;
      d += 'H' + r1(F.x(i + 1));
    }
    if (close) d += 'V' + r1(F.base) + 'H' + r1(F.x(0)) + 'Z';
    return d;
  }

  /* gaps where top > bottom, as one multi-rect path (hatched) */
  function gapPath(F, top, bottom, y) {
    var d = '';
    for (var i = 0; i < top.length; i++) {
      if (top[i] > bottom[i]) {
        var y0 = r1(y(top[i])), y1 = r1(y(bottom[i]));
        d += 'M' + r1(F.x(i)) + ' ' + y0 + 'H' + r1(F.x(i + 1)) + 'V' + y1 + 'H' + r1(F.x(i)) + 'Z';
      }
    }
    return d;
  }

  /* left-to-right reveal: a clip rect scaled on X (attribute transform) */
  function clipReveal(F, target) {
    var cid = uid(F.id + '-clip');
    var cp = svgEl('clipPath', { id: cid }, F.defs);
    var rect = svgEl('rect', { x: 0, y: 0, width: F.w, height: F.h }, cp);
    target.setAttribute('clip-path', 'url(#' + cid + ')');
    var val = Value(0, function (v) { rect.setAttribute('transform', 'scale(' + clamp(v, 0, 1).toFixed(4) + ' 1)'); }, 0.12);
    return {
      to: function (frac) { val.to(frac); },
      set: function (frac) { val.set(frac); },
      toIndex: function (i) { val.to(clamp((F.x(i + 1)) / F.w, 0, 1)); },
      setIndex: function (i) { val.set(clamp((F.x(i + 1)) / F.w, 0, 1)); }
    };
  }

  /* ---------- SL heat strip (HTML; glyph + colour + hatching) ---------- */
  var GLYPH = { ok: '✓', mid: '◐', bad: '✕' };
  function slState(v, target) { if (v == null) return 'bad'; return v >= target ? 'ok' : v >= 0.5 ? 'mid' : 'bad'; }

  function heatStrip(parent, values, o) {
    o = o || {};
    var target = o.target || 0.8;
    var wrap = h('div', 'hs' + (o.cls ? ' ' + o.cls : ''), parent);
    var row = h('div', 'hs-row', wrap);
    var cells = [];
    for (var i = 0; i < 48; i++) {
      var c = h('span', 'hs-cell', row);
      var g = h('i', 'hs-g', c);
      g.setAttribute('aria-hidden', 'true');
      cells.push({ el: c, g: g });
    }
    var ax = h('div', 'hs-axis', wrap);
    ax.setAttribute('aria-hidden', 'true');
    [0, 12, 24, 36].forEach(function (i) { h('span', null, ax, fmt.clock(i)); });
    h('span', null, ax, fmt.clock(47));
    var api = { el: wrap, values: values };
    api.set = function (vals) {
      api.values = vals;
      for (var i = 0; i < 48; i++) {
        var st = slState(vals[i], target);
        var c = cells[i];
        if (c.el.getAttribute('data-s') !== st) {
          c.el.setAttribute('data-s', st);
          c.g.textContent = GLYPH[st];
        }
        c.el.title = T('charts.heatCell', { time: fmt.clock(i), pct: vals[i] == null ? '0%' : fmt.pct(vals[i], 0) });
      }
    };
    api.reveal = revealer(cells.map(function (c) { return c.el; }));
    api.stats = function (vals) { return slStats(vals || api.values, target); };
    api.set(values);
    return api;
  }

  function slStats(vals, target) {
    var n = 0, worst = 1, worstAt = [];
    for (var i = 0; i < vals.length; i++) {
      var v = vals[i] == null ? 0 : vals[i];
      if (v < target) n++;
      if (v < worst - 1e-9) { worst = v; worstAt = [i]; } else if (Math.abs(v - worst) < 1e-9) worstAt.push(i);
    }
    return { breaches: n, worst: worst, worstAt: worstAt };
  }

  /* ---------- hover layer: invisible per-interval hit rects ---------- */
  function hover(F, onIndex) {
    var g = group(F, 'sc-hit');
    for (var i = 0; i < F.n; i++) {
      svgEl('rect', { x: r1(F.x(i)), y: F.pad.t, width: r1(F.slot), height: F.ph, 'data-i': i }, g);
    }
    g.addEventListener('pointermove', function (e) {
      var t = e.target; var i = t && t.getAttribute && t.getAttribute('data-i');
      if (i != null) onIndex(+i, e);
    });
    g.addEventListener('pointerleave', function () { onIndex(-1); });
    return g;
  }

  /* ---------- "Show the data" table ---------- */
  function dataTable(caption, headers, rows) {
    var d = h('details', 'data-table');
    h('summary', null, d, T('common.showData'));
    var sc = h('div', 'data-table-scroll', d);
    sc.setAttribute('tabindex', '0');
    sc.setAttribute('role', 'region');
    sc.setAttribute('aria-label', caption);
    var t = h('table', null, sc);
    h('caption', null, t, caption);
    var tr = h('tr', null, h('thead', null, t));
    headers.forEach(function (x) { var th = h('th', null, tr, x); th.scope = 'col'; });
    var tb = h('tbody', null, t);
    rows.forEach(function (r) {
      var row = h('tr', null, tb);
      r.forEach(function (c, k) {
        var cell = h(k === 0 ? 'th' : 'td', k ? 'num' : null, row, c);
        if (!k) cell.scope = 'row';
      });
    });
    return d;
  }

  window.SynqCharts = {
    NS: NS, el: svgEl, h: h, uid: uid, clamp: clamp, fmt: fmt,
    reduced: reduced, onReduced: onReduced, loop: loop, Value: Value, countUp: countUp,
    frame: frame, group: group, yAxis: yAxis, xAxis: xAxis, bars: bars, stack: stack,
    linePath: linePath, stepPath: stepPath, gapPath: gapPath, clipReveal: clipReveal,
    heatStrip: heatStrip, slStats: slStats, slState: slState, hover: hover, dataTable: dataTable
  };
}());
