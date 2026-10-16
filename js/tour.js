/*!
 * SYNQ tour — scroll engine, wallboard clock, hero convergence visual and the
 * five chapter stages (old · shift · new · proof · vision).
 * Reads .chapter / .stage / .step[data-step]; sets chapter.dataset.activeStep,
 * .step.is-active and --chapter-progress. All numbers come from SYNQ_DATA
 * (ILLUSTRATIVE MODEL) or the contract list in ARCHITECTURE.md §8.
 */
(function () {
  'use strict';

  var C, D, S, TOT, A, fmt, h, el, clamp;   /* TOT = D.totals */
  var RM = false;
  function T(k, p) { var I = window.SYNQ_I18N; return I ? I.t(k, p) : k; }
  function TK(parts, p) { return T(parts.join(''), p); }   /* dynamic key (prefix + name) */
  function RTL() { var I = window.SYNQ_I18N; return !!(I && I.isRTL()); }

  function ready(fn) {
    var go = function () { var I = window.SYNQ_I18N; if (I) I.whenReady(fn); else fn(); };
    if (document.readyState !== 'loading') go();
    else document.addEventListener('DOMContentLoaded', go);
  }
  function warn(where, e) { if (window.console) console.warn('[SYNQ tour] ' + where, e); }


  /* ------------------------------------------------------------------ */
  /* helpers                                                            */
  /* ------------------------------------------------------------------ */
  function max(a) { var m = -Infinity; for (var i = 0; i < a.length; i++) if (a[i] != null && a[i] > m) m = a[i]; return m; }
  function argmax(a) { var m = -Infinity, k = 0; for (var i = 0; i < a.length; i++) if (a[i] > m) { m = a[i]; k = i; } return k; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function seg(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
  function cpao(paid, ai, contacts) {
    var rate = A.human_cost_hr != null ? A.human_cost_hr : 9, aic = A.ai_cost_outcome != null ? A.ai_cost_outcome : 0.99;
    return (paid * rate + ai * aic) / (ai + (contacts - ai) * 0.97);
  }
  function toggle(node, cls, on) { if (node && node.classList.contains(cls) !== !!on) node.classList.toggle(cls, !!on); }
  function setText(node, txt) { if (node && node.textContent !== txt) node.textContent = txt; }
  function hoverable() { return window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches; }

  /* Common stage skeleton: head (stamp + readout), figure (role=img), foot. */
  function shell(stage, o) {
    while (stage.firstChild) stage.removeChild(stage.firstChild);
    stage.classList.add('is-built');
    if (o.night) stage.classList.add('stage--night');
    stage.removeAttribute('role');
    stage.removeAttribute('aria-label');
    var head = h('div', 'stage-head', stage);
    h('span', 'stamp stage-stamp', head, o.stamp || T('common.stamp'));
    var readout = h('span', 'stage-readout num', head);
    readout.setAttribute('aria-hidden', 'true');
    var fig = h('div', 'stage-figure', stage);
    fig.setAttribute('role', 'img');
    fig.setAttribute('aria-label', o.label);
    var foot = h('div', 'stage-foot', stage);
    var api = { stage: stage, head: head, readout: readout, fig: fig, foot: foot };
    api.compact = (fig.clientWidth || 600) < 520;
    toggle(stage, 'is-compact', api.compact);
    // Call after the foot is filled so the figure's final box is measured.
    api.measure = function () {
      api.w = fig.clientWidth || 600; api.h = Math.max(140, fig.clientHeight || 320);
      return api;
    };
    return api;
  }

  function layer(parent, cls) { return h('div', 'stage-layer ' + cls, parent); }

  function tooltip(fig) {
    var tip = h('div', 'stage-tip num', fig);
    tip.setAttribute('aria-hidden', 'true');
    return function (F, i, lines) {
      if (i < 0) { toggle(tip, 'is-on', false); return; }
      tip.textContent = '';
      lines.forEach(function (l, k) { h(k ? 'span' : 'b', null, tip, l); });
      var x = F.cx(i) / F.w * 100;
      tip.style.left = x + '%';
      toggle(tip, 'is-flip', x > 62);
      toggle(tip, 'is-on', true);
    };
  }

  /* returns the nodes it inserted, so a language switch can remove exactly those */
  function mountTable(chapter, name, table) {
    var added = [];
    if (!chapter) return added;
    var mount = chapter.querySelector('.data-table-mount[data-for="' + name + '"]');
    if (mount) {
      if (mount.querySelector('table')) return added;
      // mount already sits inside a "Show the data" <details>: add only the table body
      if (mount.closest && mount.closest('details')) { [].slice.call(table.children, 1).forEach(function (c) { mount.appendChild(c); added.push(c); }); }
      else { mount.appendChild(table); added.push(table); }
      return added;
    }
    if (chapter.querySelector('details.data-table')) return added;
    var inner = chapter.querySelector('.chapter-inner');
    if (inner && inner.parentNode) inner.parentNode.insertBefore(table, inner.nextSibling);
    else chapter.appendChild(table);
    added.push(table);
    return added;
  }

  function slLabel(v) { if (v == null) return '0%'; return fmt.pct(v, Math.round(v * 1000) % 10 === 0 ? 0 : 1); }
  function times(list) { return list.map(fmt.clock).join(T('tour.and')); }

  /* ------------------------------------------------------------------ */
  /* HERO — three lanes converge into one green path; work flows along. */
  /* ------------------------------------------------------------------ */
  function hero() {
    var mount = document.getElementById('hero-visual');
    if (!mount) return;
    var LANES = [
      'M 0 60 C 190 60 260 60 360 160 C 430 230 520 250 720 250',
      'M 0 130 C 190 130 260 130 360 180 C 445 223 540 250 720 250',
      'M 0 200 C 190 200 260 200 360 200 C 450 200 545 250 720 250'
    ];
    var GREEN = 'M 360 180 C 470 210 560 250 800 250';
    var svg = el('svg', { viewBox: '0 0 880 320', 'class': 'hero-svg', preserveAspectRatio: 'xMidYMid meet', focusable: 'false', 'aria-hidden': 'true' }, mount);
    var defs = el('defs', null, svg);
    var lanes = LANES.map(function (d, k) {
      return el('path', { d: d, pathLength: 1, 'class': 'hero-lane hero-lane--' + (k + 1) }, svg);
    });
    el('path', { d: GREEN, pathLength: 1, 'class': 'hero-path' }, svg);
    var itemsG = el('g', { 'class': 'hero-items' }, svg);

    // Sample each route (lane → merge → green path → exit) once.
    var routes = LANES.map(function (d) {
      var p = el('path', { d: d + ' L 800 250 L 872 250' }, defs);
      var L = p.getTotalLength(), pts = [], N = 220;
      for (var i = 0; i <= N; i++) { var q = p.getPointAtLength(L * i / N); pts.push([q.x, q.y]); }
      return { L: L, pts: pts, N: N };
    });
    var PER_LANE = [3, 3, 2], OFFS = [0, 0.17, 0.41], SPEED = 58; // units per second: slow, confident
    var items = [];
    routes.forEach(function (r, k) {
      for (var j = 0; j < PER_LANE[k]; j++) {
        var g = el('g', { 'class': 'hero-item' }, itemsG);
        el('rect', { x: -8, y: -3, width: 16, height: 6, rx: 3 }, g);
        items.push({ g: g, r: r, phase: (j / PER_LANE[k] + OFFS[k]) % 1, out: false });
      }
    });

    function place(t) {
      for (var i = 0; i < items.length; i++) {
        var it = items[i], r = it.r;
        var u = ((t / 1000) * SPEED / r.L + it.phase) % 1;
        var f = u * r.N, a = Math.floor(f), b = Math.min(r.N, a + 1), fr = f - a;
        var p0 = r.pts[a], p1 = r.pts[b];
        var x = p0[0] + (p1[0] - p0[0]) * fr, y = p0[1] + (p1[1] - p0[1]) * fr;
        var ang = Math.atan2(p1[1] - p0[1], (p1[0] - p0[0]) || 0.0001) * 57.2958;
        it.g.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + ang.toFixed(1) + ')');
        var op = x < 24 ? x / 24 : x > 806 ? clamp((872 - x) / 66, 0, 1) : 1;
        it.g.setAttribute('opacity', op.toFixed(2));
        var out = x > 800;
        if (out !== it.out) { it.out = out; it.g.classList.toggle('is-out', out); }
      }
    }

    var visible = true, loopOn = false, t0 = null, tOff = 0;
    function tick(t) {
      if (!visible || RM || document.hidden) { loopOn = false; if (t0 != null) { tOff += t - t0; t0 = null; } return false; }
      if (t0 == null) t0 = t - 0;
      place(tOff + (t - t0));
      return true;
    }
    function start() {
      if (RM) { place(7000); return; }
      if (!loopOn) { loopOn = true; t0 = null; C.loop.add(tick); }
    }
    place(7000);
    requestAnimationFrame(function () { requestAnimationFrame(function () { svg.classList.add('is-in'); }); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); }).observe(mount);
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });
    C.onReduced(function (r) { RM = r; start(); });
    start();
    return lanes;
  }

  /* ------------------------------------------------------------------ */
  /* CHAPTER 1 — the old way                                            */
  /* ------------------------------------------------------------------ */
  function dirOld(stage, chapter) {
    var pkA = argmax(S.actual_volume);
    var hs = C.slStats(S.sl_actual_human_only, A.sl_target || 0.8);
    var worstTimes = times(hs.worstAt);
    var cp = cpao(TOT.paid_hours_human_only, 0, TOT.contacts);
    var sh = shell(stage, {
      label: T('tour.old.label', {
        fpeak: max(S.volume), rpeak: max(S.scheduled), idle: TOT.idle_paid_hours_trough_human_only, apeak: S.actual_volume[pkA], atime: fmt.clock(pkA),
        breaches: hs.breaches, worst: slLabel(hs.worst), times: worstTimes, contacts: fmt.int(TOT.contacts), shifts: TOT.shifts_9h_human_only,
        paid: TOT.paid_hours_human_only, cpao: fmt.usd(cp) })
    });
    var cmp = sh.compact;
    // Foot first: lane strip (separate lanes, queues build) and the SL heat strip
    var lanesWrap = h('div', 'foot-layer foot-lanes', sh.foot);
    var lanes = laneStrip(lanesWrap, sh.foot.clientWidth || 600);
    h('p', 'hs-legend', lanesWrap, T('tour.old.lanes'));
    var hsWrap = h('div', 'foot-layer foot-hs', sh.foot);
    var heat = C.heatStrip(hsWrap, S.sl_actual_human_only, { target: A.sl_target || 0.8 });
    heat.el.setAttribute('role', 'img');
    heat.el.setAttribute('aria-label', T('tour.old.heatLabel', { breaches: hs.breaches, worst: slLabel(hs.worst), times: worstTimes }));
    h('p', 'hs-legend', hsWrap, T('tour.old.legend'));
    sh.measure();

    var chart = layer(sh.fig, 'scene-chart');
    var F = C.frame(chart, { w: sh.w, h: sh.h, pad: { t: 20, r: cmp ? 4 : 10, b: 20, l: cmp ? 26 : 34 } });
    var yC = F.scale(110), yP = F.scale(38);
    var axC = C.yAxis(F, [0, 50, 100], yC, T('tour.axis.contacts'), 'ax-c');
    var axP = C.yAxis(F, [0, 10, 20, 30], yP, T('tour.axis.people'), 'ax-p');
    C.xAxis(F, cmp ? 12 : 6);
    var bars = C.bars(F, S.volume, yC, 'is-human layer-bars');

    var ppl = C.group(F, 'layer-people');
    el('path', { d: C.stepPath(F, S.scheduled, yP, true), 'class': 'sc-area' }, ppl);
    el('path', { d: C.gapPath(F, S.scheduled, S.required_with_shrinkage, yP), 'class': 'sc-gap', fill: F.url('hatch') }, ppl);
    el('path', { d: C.stepPath(F, S.scheduled, yP, false), 'class': 'sc-edge' }, ppl);
    el('path', { d: C.linePath(F, S.required_with_shrinkage, yP), 'class': 'sc-line sc-line--dash' }, ppl);
    var pplReveal = C.clipReveal(F, ppl);

    var act = C.group(F, 'layer-actual');
    el('path', { d: C.linePath(F, S.actual_volume, yC), 'class': 'sc-line sc-line--actual' }, act);
    var actReveal = C.clipReveal(F, act);
    var pk = C.group(F, 'layer-peak');
    el('circle', { cx: F.cx(pkA), cy: yC(S.actual_volume[pkA]), r: 4, 'class': 'sc-peak' }, pk);
    el('line', { x1: F.cx(pkA), x2: F.cx(pkA), y1: yC(S.actual_volume[pkA]) + 5, y2: yC(S.volume[pkA]) - 1, 'class': 'sc-peak-rule' }, pk);
    var pkT = el('text', { x: F.cx(pkA) - 8, y: yC(S.actual_volume[pkA]) + 4, 'class': 'sc-note', 'text-anchor': 'end' }, pk);
    pkT.textContent = T(cmp ? 'tour.old.peakCmp' : 'tour.old.peak', { a: S.actual_volume[pkA], f: S.volume[pkA] });

    var now = el('line', { x1: 0, x2: 0, y1: F.pad.t, y2: F.base, 'class': 'sc-now' }, F.svg);

    // Trough callout (step 1)
    var tI = 8;
    var trough = h('div', 'stage-callout callout-trough', chart);
    trough.style.left = (F.x(3) / F.w * 100) + '%';
    var big = h('span', 'callout-big num', trough);
    var bigN = h('span', null, big, '0'); h('span', 'callout-unit', big, T('tour.old.hUnit'));
    h('span', 'callout-label', trough, T('tour.old.paidNotNeeded'));
    h('span', 'callout-sub num', trough, T('tour.old.troughSub', { time: fmt.clock(tI), sched: S.scheduled[tI], req: S.required_with_shrinkage[tI] }));

    // Bill (step 3)
    var bill = h('div', 'stage-ledger', sh.fig);
    h('p', 'ledger-eyebrow', bill, T('tour.old.billTitle'));
    var dl = h('dl', 'ledger-rows', bill);
    [[T('tour.bill.contacts'), fmt.int(TOT.contacts)], [T('tour.bill.shifts'), String(TOT.shifts_9h_human_only)], [T('tour.bill.paid'), fmt.int(TOT.paid_hours_human_only)],
      [T('tour.bill.cpao'), fmt.usd(cp)]].forEach(function (r) {
      var d = h('div', null, dl); h('dt', null, d, r[0]); h('dd', 'num', d, r[1]);
    });
    h('p', 'ledger-note', bill, T('tour.old.billNote', { rate: A.human_cost_hr || 9, breaches: hs.breaches, worst: slLabel(hs.worst) }));

    var tip = tooltip(sh.fig);
    if (hoverable()) C.hover(F, function (i) {
      tip(F, i, i < 0 ? [] : [fmt.clock(i), T('tour.tip.forecast', { n: S.volume[i] }), T('tour.tip.actual', { n: S.actual_volume[i] }), T('tour.tip.scheduled', { n: S.scheduled[i] }), T('tour.tip.sl', { n: slLabel(S.sl_actual_human_only[i]) })]);
    });

    var st = { step: -1, counted: false, shakeArmed: true, entered: false };
    function clockOf(a, p) { return a >= 3 ? 47 : clamp(Math.floor((a + p) / 3 * 48), 0, 47); }

    return {
      clock: clockOf,
      apply: function (a, p, entered) {
        if (!entered && !st.entered) return;
        st.entered = true;
        if (a !== st.step) { sh.stage.setAttribute('data-step', a); st.step = a; }
        var ci = clockOf(a, p);
        bars.reveal(48);
        now.setAttribute('transform', 'translate(' + F.cx(ci).toFixed(1) + ' 0)');
        toggle(now, 'is-off', a >= 3);
        // people layer draws with the scroll in step 1
        pplReveal.to(a === 1 ? ease(seg(p, 0, 0.55)) : a > 1 ? 1 : 0);
        if (a === 1 && p > 0.3 && !st.counted) { st.counted = true; C.countUp(bigN, 0, TOT.idle_paid_hours_trough_human_only, { format: function (n) { return n.toFixed(1); }, duration: 1100 }); }
        if (a < 1 || (a === 1 && p < 0.15)) { if (st.counted) { st.counted = false; bigN.textContent = '0'; } }
        if (a > 1 && !st.counted) { st.counted = true; bigN.textContent = String(TOT.idle_paid_hours_trough_human_only); }
        // the actual day arrives with the clock
        if (a === 2) actReveal.toIndex(ci); else actReveal.to(a > 2 ? 1 : 0);
        heat.reveal(a === 2 ? ci + 1 : a > 2 ? 48 : 0);
        toggle(pk, 'is-on', a > 2 || (a === 2 && ci >= pkA));
        lanes.queue(ci, a);
        // one 2px shake when the clock reaches 21:00
        if (a === 2 && ci >= 42 && st.shakeArmed) {
          st.shakeArmed = false;
          if (!RM) { sh.stage.classList.remove('is-shake'); void sh.stage.offsetWidth; sh.stage.classList.add('is-shake'); }
        }
        if (a < 2 || ci < 40) st.shakeArmed = true;
        var r;
        if (a === 0) r = T('tour.old.r0', { time: fmt.clock(ci), n: S.volume[ci] });
        else if (a === 1) r = T('tour.old.r1', { time: fmt.clock(ci), need: S.required_with_shrinkage[ci], rostered: S.scheduled[ci] });
        else if (a === 2) r = T(S.sl_actual_human_only[ci] === 0 ? 'tour.old.r2q' : 'tour.old.r2', { time: fmt.clock(ci), n: S.actual_volume[ci], sl: slLabel(S.sl_actual_human_only[ci]) });
        else r = T('tour.breaches', { breaches: hs.breaches, worst: slLabel(hs.worst) });
        setText(sh.readout, r);
        toggle(axC, 'is-dim', a === 1);
        toggle(axP, 'is-dim', a !== 1);
      },
      table: function () {
        var rows = [];
        for (var i = 0; i < 48; i++) rows.push([fmt.clock(i), S.volume[i], S.actual_volume[i], S.required_with_shrinkage[i], S.scheduled[i], slLabel(S.sl_actual_human_only[i])]);
        return C.dataTable(T('tour.old.tableCaption'),
          [T('tour.th.interval'), T('tour.th.forecast'), T('tour.th.actual'), T('tour.th.required'), T('tour.th.scheduled'), T('tour.th.slHuman')], rows);
      }
    };
  }

  /* Old-way motif: three separate lanes, each ending at its own desk; queues pile up. */
  function laneStrip(parent, W) {
    var H = 44, x0 = 4, x1 = W - 30, Q = 6;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, 'class': 'lane-strip', width: W, height: H, 'aria-hidden': 'true', focusable: 'false' }, parent);
    var cid = C.uid('ls');
    var cp = el('clipPath', { id: cid }, el('defs', null, svg));
    var queues = [], weights = [1, 0.8, 0.55];
    [8, 22, 36].forEach(function (y, k) {
      el('rect', { x: x0, y: y - 3, width: x1 - x0, height: 6, rx: 3, 'class': 'ls-lane ls-lane--' + (k + 1) }, svg);
      el('rect', { x: x0, y: y - 4, width: x1 - x0 - Q * 9, height: 8 }, cp);
      var flow = el('g', { 'class': 'ls-flow ls-flow--' + (k + 1), 'clip-path': 'url(#' + cid + ')' }, svg);
      var inner = el('g', { 'class': 'ls-move' }, flow);
      for (var x = x0 - 40; x < x1; x += 40) el('rect', { x: x, y: y - 2, width: 10, height: 4, rx: 2, 'class': 'ls-item' }, inner);
      var qs = [];
      for (var j = 0; j < Q; j++) qs.push(el('rect', { x: x1 - 8 - j * 9, y: y - 2, width: 7, height: 4, rx: 2, 'class': 'ls-q' }, svg));
      el('rect', { x: x1 + 4, y: y - 6, width: 3, height: 12, rx: 1, 'class': 'ls-desk' }, svg);
      queues.push(qs);
    });
    return {
      queue: function (ci, a) {
        var ratio = a >= 2 ? 1 : (S.volume[ci] / max(S.volume));
        queues.forEach(function (qs, k) {
          var n = Math.round(ratio * Q * weights[k]);
          qs.forEach(function (r, j) { toggle(r, 'is-on', j < n); });
        });
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* CHAPTER 2 — the shift                                              */
  /* ------------------------------------------------------------------ */
  function dirShift(stage) {
    var e = A.eligible_share || 0.3;
    var sh = shell(stage, {
      label: T('tour.shift.label')
    });
    var cmp = sh.compact;
    var leg = h('ul', 'stage-legend', sh.foot);
    [['is-eligible', T('tour.shift.legElig', { pct: Math.round(e * 100) }), T('tour.shift.modelled')], ['is-human', T('tour.shift.legOther'), T('tour.shift.illustrative')], ['is-hatch', T('tour.shift.legJudge'), T('tour.shift.illustrative')]].forEach(function (r) {
      var li = h('li', null, leg); h('i', 'sw ' + r[0], li); h('span', null, li, r[1]); h('em', null, li, r[2]);
    });
    sh.measure();
    var q = h('div', 'shift-q', sh.fig);
    var q1 = h('p', 'shift-q1', q);
    h('span', 'shift-q1-t', q1, T('tour.shift.q1'));
    h('span', 'shift-strike', q1);
    h('p', 'shift-q2', q, T('tour.shift.q2'));
    var chart = layer(sh.fig, 'scene-chart shift-chart');
    var ch = Math.max(90, Math.round(sh.h * 0.5));
    var F = C.frame(chart, { w: sh.w, h: ch, pad: { t: 6, r: cmp ? 4 : 10, b: 18, l: cmp ? 4 : 10 } });
    var y = F.scale(max(S.volume) * 1.05);
    C.xAxis(F, cmp ? 12 : 6);
    var plain = C.bars(F, S.volume, y, 'is-human layer-plain');
    var other = S.volume.map(function (v) { return v * 0.5; });
    var judge = S.volume.map(function (v) { return v * 0.2; });
    var elig = S.volume.map(function (v) { return v * e; });
    var stk = C.stack(F, [other, judge, elig], y, ['is-human', 'is-hatch', 'is-eligible']);
    toggle(stk.g, 'layer-split', true);
    var st = { step: -1, entered: false };
    return {
      clock: function () { return 0; },
      apply: function (a, p, entered) {
        if (!entered && !st.entered) return;
        st.entered = true;
        if (a !== st.step) { sh.stage.setAttribute('data-step', a); st.step = a; }
        plain.reveal(48);
        toggle(q, 'is-turned', a > 0 || p > 0.35);
        var split = a >= 1 && (p > 0.12 || RM);
        stk.reveal.forEach(function (r) { r(split ? 48 : 0); });
        toggle(sh.stage, 'is-split', split);
        setText(sh.readout, split ? T('tour.shift.readSplit') : T('tour.shift.readForecast'));
      },
      table: function () {
        var rows = [];
        for (var i = 0; i < 48; i++) rows.push([fmt.clock(i), S.volume[i], elig[i].toFixed(1), other[i].toFixed(1), judge[i].toFixed(1)]);
        return C.dataTable(T('tour.shift.tableCaption'),
          [T('tour.th.interval'), T('tour.th.forecast'), T('tour.shift.thElig'), T('tour.shift.thOther'), T('tour.shift.thJudge')], rows);
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* CHAPTER 3 — the new way                                            */
  /* ------------------------------------------------------------------ */
  function dirNew(stage) {
    var tgt = A.sl_target || 0.8;
    var modes = [
      { key: 'human', name: T('tour.mode.human'), short: T('tour.mode.humanShort'), data: S.sl_actual_human_only },
      { key: 'static', name: T('tour.mode.static'), short: T('tour.mode.staticShort'), data: S.sl_actual_hybrid },
      { key: 'elastic', name: T('tour.mode.elastic'), short: T('tour.mode.elasticShort'), data: S.sl_actual_hybrid_elastic }
    ];
    modes.forEach(function (m) { m.stats = C.slStats(m.data, tgt); });
    var cpH = cpao(TOT.paid_hours_human_only, 0, TOT.contacts), cpY = cpao(TOT.paid_hours_hybrid, TOT.ai_accepted_outcomes, TOT.contacts);
    var pk0 = max(S.scheduled), pk1 = max(S.scheduled_hybrid);
    var sh = shell(stage, {
      label: T('tour.new.label', {
        ai: TOT.ai_accepted_outcomes, pk0: pk0, pk1: pk1,
        b0: modes[0].stats.breaches, w0: slLabel(modes[0].stats.worst), b1: modes[1].stats.breaches, w1: slLabel(modes[1].stats.worst),
        b2: modes[2].stats.breaches, w2: slLabel(modes[2].stats.worst), removed: TOT.volume_removed_from_humans_pct,
        paid0: TOT.paid_hours_human_only, paid1: TOT.paid_hours_hybrid, red: TOT.paid_hours_reduction_pct,
        sh0: TOT.shifts_9h_human_only, sh1: TOT.shifts_9h_hybrid, cp0: fmt.usd(cpH), cp1: fmt.usd(cpY) })
    });
    var cmp = sh.compact;
    var res = h('ol', 'foot-layer route-results', sh.foot);
    [['✓', T('tour.route.retTitle'), T('tour.route.retText'), 'ok'],
      ['◐', T('tour.route.refTitle'), T('tour.route.refText'), 'mid'],
      ['✕', T('tour.route.fraudTitle'), T('tour.route.fraudText'), 'bad']].forEach(function (r) {
      var li = h('li', 'route-res', res); li.setAttribute('data-s', r[3]);
      h('i', 'route-res-g', li, r[0]).setAttribute('aria-hidden', 'true'); h('b', null, li, r[1]); h('span', null, li, r[2]);
    });
    var resLis = res.children;

    // roster band (foot, step 1)
    var rosterWrap = h('div', 'foot-layer foot-roster', sh.foot);
    var fw = sh.foot.clientWidth || 600;
    var RF = C.frame(rosterWrap, { w: fw, h: cmp ? 56 : 64, pad: { t: 14, r: cmp ? 4 : 10, b: 2, l: cmp ? 26 : 34 } });
    var yR = RF.scale(36);
    var rb = C.bars(RF, S.scheduled, yR, 'is-roster');
    rb.reveal(48);
    el('path', { d: C.stepPath(RF, S.scheduled, yR, false), 'class': 'sc-edge sc-edge--ghost' }, RF.svg);
    var rlab = el('text', { x: RF.pad.l, y: 10, 'class': 'sc-unit' }, RF.svg);
    rlab.textContent = T('tour.new.roster', { pk0: pk0, pk1: pk1 });

    // heat strip + toggle (foot, steps 2-3)
    var hsWrap = h('div', 'foot-layer foot-hs', sh.foot);
    var tg = h('div', 'sl-toggle', hsWrap);
    tg.setAttribute('role', 'group');
    tg.setAttribute('aria-label', T('tour.new.modeGroup'));
    var btns = modes.map(function (m, k) {
      var b = h('button', 'sl-btn', tg, cmp ? m.short : m.name);
      b.type = 'button'; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { st.user = true; setMode(k); });
      b.addEventListener('keydown', function (ev) {
        var d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        ev.preventDefault(); var n = (k + d + 3) % 3; st.user = true; setMode(n); btns[n].focus();
      });
      return b;
    });
    var heat = C.heatStrip(hsWrap, modes[0].data, { target: tgt });
    heat.reveal(48);
    heat.el.setAttribute('role', 'img');
    var hsRead = h('p', 'hs-legend num', hsWrap);
    function setMode(k) {
      if (k === st.mode) return;
      st.mode = k;
      var m = modes[k];
      heat.set(m.data);
      btns.forEach(function (b, j) { b.setAttribute('aria-pressed', j === k ? 'true' : 'false'); });
      var mp = { mode: m.name, breaches: m.stats.breaches, worst: slLabel(m.stats.worst) };
      heat.el.setAttribute('aria-label', T('tour.new.modeAria', mp));
      setText(hsRead, T('tour.new.modeRead', mp));
      if (st.step === 2) setText(sh.readout, T('tour.breaches', mp));
    }

    sh.measure();
    var W = sh.w, H = sh.h;


    /* scene A: routing gates */
    var route = layer(sh.fig, 'scene-route');
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, 'class': 'sc-svg route-svg', 'aria-hidden': 'true', focusable: 'false' }, route);
    var defs = el('defs', null, svg);
    var cw = cmp ? 92 : 128, chh = cmp ? 18 : 22;
    var yc = Math.round(H * 0.4), ya = Math.round(H * 0.8), dy = cmp ? 22 : 30;
    var gx = (cmp ? [0.3, 0.44, 0.58, 0.72] : [0.3, 0.42, 0.54, 0.66]).map(function (f) { return Math.round(W * f); });
    var GN = ['intent', 'context', 'policy', 'permission'];
    var x0 = cw / 2 + 2, xg0 = gx[0] - 10, xp = gx[3] + 6;
    var inL = [yc - dy, yc, yc + dy].map(function (yy) {
      return 'M ' + x0 + ' ' + yy + ' C ' + (x0 + (xg0 - x0) * 0.55) + ' ' + yy + ' ' + (x0 + (xg0 - x0) * 0.55) + ' ' + yc + ' ' + xg0 + ' ' + yc;
    });
    inL.forEach(function (d, k) { el('path', { d: d, 'class': 'route-in route-in--' + (k + 1) }, svg); });
    el('path', { d: 'M ' + xg0 + ' ' + yc + ' L ' + W + ' ' + yc, 'class': 'route-human' }, svg);
    var aiC = ' C ' + (xp + W * 0.09) + ' ' + yc + ' ' + (xp + W * 0.07) + ' ' + ya + ' ' + (xp + W * 0.17) + ' ' + ya;
    var aiD = 'M ' + xp + ' ' + yc + aiC + ' L ' + W + ' ' + ya;
    el('path', { d: aiD, 'class': 'route-ai' }, svg);
    var tagH = el('text', { x: xp + 14, y: yc - 10, 'class': 'sc-note route-tag' }, svg); tagH.textContent = T(cmp ? 'tour.route.humanLaneCmp' : 'tour.route.humanLane');
    var tagA = el('text', { x: cmp ? W - 2 : xp + W * 0.17 + 6, y: ya + 22, 'text-anchor': cmp ? 'end' : 'start', 'class': 'sc-note route-tag route-tag--ai' }, svg); tagA.textContent = T('tour.route.aiLane');
    var gates = gx.map(function (x, k) {
      var g = el('g', { 'class': 'route-gate' }, svg);
      el('line', { x1: x, x2: x, y1: yc - dy - 14, y2: yc + dy + 10, 'class': 'route-gate-line' }, g);
      var t = el('text', { x: x, y: yc - dy - 20, 'text-anchor': 'middle', 'class': 'sc-tick route-gate-t' }, g);
      el('tspan', { 'class': 'ck' }, t).textContent = '✓ ';
      t.appendChild(document.createTextNode((cmp && k === 3) ? T('tour.gate.permit') : TK(['tour.gate.', GN[k]])));
      return g;
    });
    var stopG = el('g', { 'class': 'route-stop', transform: 'translate(' + gx[2] + ' ' + yc + ')' }, svg);
    el('circle', { r: cmp ? 9 : 11, 'class': 'route-stop-c' }, stopG);
    var sx = el('text', { y: 4, 'text-anchor': 'middle', 'class': 'route-stop-x' }, stopG); sx.textContent = '✕';
    var endX = W - cw / 2 - 4;
    var R = [
      { d: inL[0] + ' L ' + xp + ' ' + yc + aiC + ' L ' + endX + ' ' + ya, label: T(cmp ? 'tour.route.retChipCmp' : 'tour.route.retChip'), win: [0, 0.42] },
      { d: inL[1] + ' L ' + endX + ' ' + yc, label: T(cmp ? 'tour.route.refChipCmp' : 'tour.route.refChip'), win: [0.22, 0.68] },
      { d: inL[2] + ' L ' + (gx[2] - cw / 2 - 14) + ' ' + yc, label: T(cmp ? 'tour.route.fraudChipCmp' : 'tour.route.fraudChip'), win: [0.5, 0.9] }
    ];
    var itemsG = el('g', null, svg);
    R.forEach(function (r, k) {
      r.p = el('path', { d: r.d }, defs);
      r.L = r.p.getTotalLength();
      r.g = el('g', { 'class': 'route-item route-item--' + (k + 1) }, itemsG);
      el('rect', { x: -cw / 2, y: -chh / 2, width: cw, height: chh, rx: 4 }, r.g);
      var t = el('text', { y: 3.5, 'text-anchor': 'middle' }, r.g); t.textContent = r.label;
    });

    /* scene B: stacked bars + roster + heat strip */
    var chart = layer(sh.fig, 'scene-chart');
    var F = C.frame(chart, { w: W, h: H, pad: { t: 20, r: cmp ? 4 : 10, b: 20, l: cmp ? 26 : 34 } });
    var yC = F.scale(110);
    C.yAxis(F, [0, 50, 100], yC, T('tour.axis.contacts'));
    C.xAxis(F, cmp ? 12 : 6);
    var stk = C.stack(F, [S.human_volume_equiv, S.ai_accepted], yC, ['is-human', 'is-ai']);
    var hp = max(S.human_volume_equiv);
    var lvl = C.group(F, 'layer-level');
    el('line', { x1: F.pad.l, x2: F.w - F.pad.r, y1: yC(hp), y2: yC(hp), 'class': 'sc-level' }, lvl);
    var lt = el('text', { x: F.w - F.pad.r, y: yC(hp) - 5, 'text-anchor': 'end', 'class': 'sc-note' }, lvl);
    lt.textContent = T('tour.new.humanPeak', { h: Math.round(hp), f: max(S.volume) });
    var tip = tooltip(sh.fig);
    if (hoverable()) C.hover(F, function (i) {
      tip(F, i, i < 0 ? [] : [fmt.clock(i), T('tour.tip.human', { n: S.human_volume_equiv[i] }), T('tour.tip.ai', { n: S.ai_accepted[i] }), T('tour.tip.roster', { a: S.scheduled[i], b: S.scheduled_hybrid[i] })]);
    });

    // readout ledger (step 3)
    var led = h('div', 'stage-ledger', sh.fig);
    h('p', 'ledger-eyebrow', led, T('tour.new.ledgerTitle'));
    var dl = h('dl', 'ledger-rows', led);
    [[T('tour.new.removed'), T('tour.val.pct', { n: TOT.volume_removed_from_humans_pct })],
      [T('tour.bill.paid'), T('tour.new.paidVal', { a: TOT.paid_hours_human_only, b: TOT.paid_hours_hybrid, pct: TOT.paid_hours_reduction_pct })],
      [T('tour.bill.shifts'), T('tour.val.arrow', { a: TOT.shifts_9h_human_only, b: TOT.shifts_9h_hybrid })],
      [T('tour.bill.cpao'), T('tour.val.arrow', { a: fmt.usd(cpH), b: fmt.usd(cpY) })]].forEach(function (r, k) {
      var d = h('div', k === 3 ? 'is-key' : null, dl); h('dt', null, d, r[0]); h('dd', 'num', d, r[1]);
    });
    var nt = h('ul', 'ledger-truths', led);
    h('li', null, nt, T('tour.new.truth1'));
    h('li', null, nt, T('tour.new.truth2'));
    h('p', 'ledger-note', led, T('tour.new.ledgerNote', { rate: A.human_cost_hr || 9, ai: A.ai_cost_outcome || 0.99 }));

    var st = { step: -1, mode: -1, user: false, entered: false, hybrid: null };
    setMode(2);
    function clockOf(a, p) { return a >= 3 ? 47 : clamp(Math.floor((a + p) / 3 * 48), 0, 47); }

    function placeItems(p) {
      var passed = -1;
      R.forEach(function (r, k) {
        var t = ease(seg(p, r.win[0], r.win[1]));
        var pt = r.p.getPointAtLength(r.L * t);
        r.g.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1) + ')');
        toggle(r.g, 'is-ai', k === 0 && pt.x > xp + 4);
        var done = t >= 0.999;
        toggle(r.g, 'is-done', done);
        toggle(resLis[k], 'is-on', done);
        if (k === 0) gx.forEach(function (x, j) { if (pt.x > x) passed = j; });
        if (k === 2) toggle(stopG, 'is-on', done);
      });
      gates.forEach(function (g, j) { toggle(g, 'is-pass', j <= passed); });
    }

    return {
      clock: clockOf,
      apply: function (a, p, entered) {
        if (!entered && !st.entered) return;
        st.entered = true;
        if (a !== st.step) { sh.stage.setAttribute('data-step', a); st.step = a; }
        placeItems(a > 0 ? 1 : p);
        stk.reveal[0](a >= 1 ? 48 : 0);
        stk.reveal[1](a > 1 || (a === 1 && p > 0.12) ? 48 : 0);
        var hy = a > 1 || (a === 1 && p > 0.4);
        if (hy !== st.hybrid) {
          st.hybrid = hy;
          rb.rects.forEach(function (r, i) {
            var k = hy ? S.scheduled_hybrid[i] / Math.max(1, S.scheduled[i]) : 1;
            r.style.transform = 'scaleY(' + k.toFixed(3) + ')';
          });
        }
        if (a === 2 && !st.user && !RM) setMode(p < 0.34 ? 0 : p < 0.67 ? 1 : 2);
        if (a !== 2 && !st.user) setMode(2);
        var ci = clockOf(a, p), r;
        if (a === 0) r = T('tour.new.r0');
        else if (a === 1) r = T(cmp ? 'tour.new.r1Cmp' : 'tour.new.r1', { ai: TOT.ai_accepted_outcomes, peak: hy ? pk1 : pk0 });
        else if (a === 2) r = T('tour.breaches', { breaches: modes[st.mode].stats.breaches, worst: slLabel(modes[st.mode].stats.worst) });
        else r = T('tour.new.r3', { a: fmt.usd(cpH), b: fmt.usd(cpY) });
        setText(sh.readout, r);
        return ci;
      },
      table: function () {
        var rows = [];
        for (var i = 0; i < 48; i++) rows.push([fmt.clock(i), S.human_volume_equiv[i], S.ai_accepted[i], S.scheduled[i], S.scheduled_hybrid[i],
          slLabel(S.sl_actual_human_only[i]), slLabel(S.sl_actual_hybrid[i]), slLabel(S.sl_actual_hybrid_elastic[i])]);
        return C.dataTable(T('tour.new.tableCaption'),
          [T('tour.th.interval'), T('tour.new.thHuman'), T('tour.new.thAi'), T('tour.new.thSched0'), T('tour.new.thSched1'), T('tour.th.slHuman'), T('tour.new.thSlStatic'), T('tour.new.thSlElastic')], rows);
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* CHAPTER 4 — the proof rail                                         */
  /* ------------------------------------------------------------------ */
  function dirProof(stage) {
    var stages = D.stages || [];
    var NAMES = { historical: T('tour.stage.historical'), shadow: T('tour.stage.shadow'), assisted: T('tour.stage.assisted'), autonomous: T('tour.stage.autonomous') };
    var sh = shell(stage, {
      label: T('tour.proof.label', {
        list: stages.map(function (s) {
          return T('tour.proof.labelItem', { name: NAMES[s.stage] || s.stage, hours: fmt.int(s.paid_hours), ai: s.live_ai_accepted });
        }).join(T('common.listSep'))
      })
    });
    var cmp = sh.compact;
    var gate = h('p', 'rail-gate num', sh.foot);
    gate.textContent = T('tour.proof.gate');
    sh.measure();
    var rail = h('div', 'rail', sh.fig);
    var cursor = h('div', 'rail-cursor', rail);
    var colW = Math.max(60, (sh.w - (cmp ? 18 : 36)) / 4);
    var miniH = Math.max(48, Math.round(sh.h * (cmp ? 0.36 : 0.5)));
    var top = max(S.volume) * 1.05;
    var cols = stages.map(function (s, k) {
      var c = h('div', 'rail-col', rail);
      var hd = h('div', 'rail-head', c);
      h('span', 'rail-n num', hd, '0' + (k + 1));
      h('span', 'rail-name', hd, NAMES[s.stage] || s.stage);
      var mini = h('div', 'rail-mini', c);
      var F = C.frame(mini, { w: colW, h: miniH, pad: { t: 2, r: 1, b: 2, l: 1 }, gap: colW > 140 ? 1 : 0.5 });
      var y = F.scale(top);
      var bars;
      if (s.stage === 'autonomous') bars = C.stack(F, [S.human_volume_equiv, S.ai_accepted], y, ['is-human', 'is-ai']).reveal;
      else {
        var base = s.stage === 'assisted' ? S.volume.map(function (v, i) { return v - S.ai_accepted[i]; }) : S.volume;
        var parts = s.stage === 'assisted' ? [base, S.ai_accepted] : [S.volume];
        bars = C.stack(F, parts, y, s.stage === 'assisted' ? ['is-human', 'is-assist'] : ['is-human']).reveal;
        if (s.stage !== 'assisted') {
          var gg = C.group(F, 'sc-ghost' + (s.stage === 'shadow' ? ' is-shadow' : ''));
          for (var i = 0; i < 48; i++) {
            var y1 = y(S.volume[i]), y0 = y(S.volume[i] - S.ai_accepted[i]);
            el('rect', { x: F.x(i) + F.gap / 2, y: y1, width: F.bw, height: Math.max(0, y0 - y1) }, gg);
          }
        }
      }
      bars.forEach(function (r) { r(48); });
      var cap = h('p', 'rail-cap', c, s.stage === 'historical' ? T('tour.proof.capHistorical') : s.stage === 'shadow' ? T('tour.proof.capShadow') : s.stage === 'assisted' ? T('tour.proof.capAssisted') : T('tour.proof.capAutonomous'));
      var dl = h('dl', 'rail-stats', c);
      var d1 = h('div', null, dl); h('dt', null, d1, T(cmp ? 'tour.proof.paidCmp' : 'tour.proof.paid')); var hrs = h('dd', 'num', d1, fmt.int(TOT.paid_hours_human_only));
      var d2 = h('div', null, dl); h('dt', null, d2, T(cmp ? 'tour.proof.liveCmp' : 'tour.proof.live')); h('dd', 'num', d2, s.live_ai_accepted ? T('tour.proof.perDay', { n: fmt.int(s.live_ai_accepted) }) : fmt.int(s.live_ai_accepted));
      return { el: c, hrs: hrs, s: s, cap: cap };
    });
    var st = { step: -1, entered: false };
    return {
      clock: function () { return null; },
      apply: function (a, p, entered) {
        if (!entered && !st.entered) return;
        st.entered = true;
        a = clamp(a, 0, cols.length - 1);
        if (a === st.step) return;
        var prev = st.step; st.step = a;
        sh.stage.setAttribute('data-step', a);
        cursor.style.transform = RTL()
          ? 'translateX(calc(-' + (a * 100) + '% - ' + (a * (cmp ? 6 : 12)) + 'px))'
          : 'translateX(calc(' + (a * 100) + '% + ' + (a * (cmp ? 6 : 12)) + 'px))';
        cols.forEach(function (c, k) {
          toggle(c.el, 'is-current', k === a); toggle(c.el, 'is-past', k < a); toggle(c.el, 'is-future', k > a);
          if (k === a && k > prev) C.countUp(c.hrs, TOT.paid_hours_human_only, c.s.paid_hours, { duration: 900 });
          else if (k <= a) c.hrs.textContent = fmt.int(c.s.paid_hours);
          else c.hrs.textContent = fmt.int(c.s.paid_hours);
        });
        setText(sh.readout, T('tour.proof.readout', { name: NAMES[cols[a].s.stage] || '', hours: fmt.int(cols[a].s.paid_hours) }));
        setText(gate, a < cols.length - 1 ? T('tour.proof.gateNext', { stage: (NAMES[cols[a + 1].s.stage] || '').toLowerCase() }) : T('tour.proof.gateLast'));
      },
      table: function () {
        return C.dataTable(T('tour.proof.tableCaption'),
          [T('tour.proof.thStage'), T('tour.bill.paid'), T('tour.proof.thLive'), T('tour.proof.thHuman')],
          stages.map(function (s) { return [NAMES[s.stage] || s.stage, s.paid_hours, s.live_ai_accepted, fmt.int(s.human_contacts_equiv)]; }));
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* CHAPTER 6 — the vision (scoped dark stage, no numbers)             */
  /* ------------------------------------------------------------------ */
  function dirVision(stage) {
    var sh = shell(stage, {
      night: true, stamp: T('tour.vision.stamp'),
      label: T('tour.vision.label')
    });
    var cmp = sh.compact;
    var leg = h('ul', 'stage-legend foot-layer', sh.foot);
    [['is-v-human', T('tour.vision.humans')], ['is-ai', T('tour.vision.ai')], ['is-v-auto', T('tour.vision.auto')], ['is-hatch', T('tour.vision.bpo')]].forEach(function (r) {
      var li = h('li', null, leg); h('i', 'sw ' + r[0], li); h('span', null, li, r[1]);
    });
    sh.measure();
    var W = sh.w, H = sh.h;
    var chart = layer(sh.fig, 'scene-chart');
    var F = C.frame(chart, { w: W, h: H, pad: { t: 12, r: cmp ? 4 : 10, b: 18, l: cmp ? 4 : 10 } });
    var y = F.scale(max(S.volume) * 1.08);
    C.xAxis(F, cmp ? 12 : 6);
    var sh4 = [0.42, 0.28, 0.18, 0.12]; // shape only, never labelled
    var stk = C.stack(F, sh4.map(function (f) { return S.volume.map(function (v) { return v * f; }); }), y, ['is-v-human', 'is-ai', 'is-v-auto', 'is-hatch']);
    var conv = layer(sh.fig, 'scene-conv');
    var svg = el('svg', { viewBox: '0 0 800 320', preserveAspectRatio: 'xMidYMid meet', 'class': 'sc-svg conv-svg', 'aria-hidden': 'true', focusable: 'false' }, conv);
    var LP = [
      'M 0 40 C 190 40 270 50 380 150 C 450 215 540 240 700 240',
      'M 0 110 C 190 110 270 115 380 170 C 460 210 545 240 700 240',
      'M 0 180 C 190 180 270 180 380 190 C 465 200 550 240 700 240',
      'M 0 250 C 190 250 270 250 380 215 C 470 200 555 240 700 240'
    ];
    var lanes = LP.map(function (d, k) { return el('path', { d: d, pathLength: 1, 'class': 'conv-lane conv-lane--' + (k + 1) }, svg); });
    var green = el('path', { d: 'M 380 185 C 480 205 570 240 790 240', pathLength: 1, 'class': 'conv-green' }, svg);
    var ct = el('text', { x: 790, y: 290, 'text-anchor': 'end', 'class': 'conv-t' }, svg); ct.textContent = T('tour.vision.one');
    var lad = h('ol', 'ladder', sh.fig);
    var rungs = [[T('tour.vision.service'), T('tour.vision.today')], ['SYNQ Lens', T('tour.vision.hypothesis')], ['SYNQ Live', T('tour.vision.hypothesis')], ['SYNQ Control', T('tour.vision.hypothesis')]].map(function (r, k) {
      var li = h('li', 'ladder-rung' + (k === 0 ? ' is-now' : ''), lad);
      h('span', 'ladder-cur', li, k === 0 ? '▸' : '').setAttribute('aria-hidden', 'true');
      h('span', 'ladder-name', li, r[0]); h('span', 'ladder-tag num', li, r[1]);
      return li;
    });
    var draw = C.Value(0, function (v) {
      lanes.forEach(function (l, k) { l.style.strokeDashoffset = (1 - clamp(v * 1.25 - k * 0.08, 0, 1)).toFixed(3); });
      green.style.strokeDashoffset = (1 - clamp(v * 1.6 - 0.6, 0, 1)).toFixed(3);
    }, 0.14);
    var st = { step: -1, entered: false };
    return {
      clock: function () { return T('tour.vision.clock'); },
      apply: function (a, p, entered) {
        if (!entered && !st.entered) return;
        st.entered = true;
        if (a !== st.step) { sh.stage.setAttribute('data-step', a); st.step = a; }
        stk.reveal.forEach(function (r) { r(48); });
        draw.to(a === 1 ? ease(seg(p, 0, 0.6)) : a > 1 ? 1 : 0);
        var n = a < 2 ? 0 : RM ? 4 : 1 + Math.floor(seg(p, 0, 0.6) * 4);
        rungs.forEach(function (r, k) { toggle(r, 'is-on', k < n); });
        setText(sh.readout, a === 2 ? T('tour.vision.readLadder') : T('tour.vision.readTomorrow'));
      },
      table: null
    };
  }

  /* ------------------------------------------------------------------ */
  /* scroll engine + wallboard clock                                    */
  /* ------------------------------------------------------------------ */
  var DIRS = { old: dirOld, shift: dirShift, 'new': dirNew, proof: dirProof, vision: dirVision };

  function tour() {
    var nodes = [].slice.call(document.querySelectorAll('.chapter'));
    var mqNarrow = window.matchMedia('(max-width: 899px)');
    var clockEl = document.getElementById('tour-clock');
    var rail = null, ticks = [];
    if (clockEl) {
      rail = h('div', 'tour-rail', document.body);
      rail.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < 48; i++) ticks.push(h('i', null, rail));
      clockEl.setAttribute('data-state', 'off');
    }
    var chs = [];
    nodes.forEach(function (node) {
      var name = node.getAttribute('data-chapter');
      var stage = node.querySelector('.stage');
      var steps = [].slice.call(node.querySelectorAll('.step'));
      steps.sort(function (a, b) { return (+a.getAttribute('data-step') || 0) - (+b.getAttribute('data-step') || 0); });
      if (!steps.length) return;
      var ch = { el: node, name: name, stage: stage, steps: steps, n: steps.length, awake: true, active: -1, dir: null, sw: 0, shh: 0 };
      node.classList.add('is-enhanced');
      build(ch, false);
      ch.tableNodes = [];
      if (ch.dir && ch.dir.table) { try { ch.tableNodes = mountTable(node, name, ch.dir.table()); } catch (e) { warn('table ' + name, e); } }
      chs.push(ch);
    });

    /* live language switch: rebuild every stage and its data table from the new pack */
    function rebuildLang() {
      chs.forEach(function (ch) {
        (ch.tableNodes || []).forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
        ch.tableNodes = [];
        ch.active = -1;
        build(ch, true);
        if (ch.dir && ch.dir.table) { try { ch.tableNodes = mountTable(ch.el, ch.name, ch.dir.table()); } catch (e) { warn('table ' + ch.name, e); } }
      });
      lastClock = null;
      schedule();
    }
    if (window.SYNQ_I18N) window.SYNQ_I18N.onChange(rebuildLang);

    function build(ch, instant) {
      if (!ch.stage || !DIRS[ch.name]) return;
      try {
        if (instant) ch.stage.classList.add('is-instant');
        ch.dir = DIRS[ch.name](ch.stage, ch.el);
        ch.sw = ch.stage.clientWidth; ch.shh = ch.stage.clientHeight;
        if (instant) requestAnimationFrame(function () { requestAnimationFrame(function () { ch.stage.classList.remove('is-instant'); }); });
      } catch (e) { warn('stage ' + ch.name, e); ch.dir = null; }
    }

    var lastClock = null, lastTick = -2;
    function setClock(v) {
      if (!clockEl) return;
      var state = v == null ? 'off' : typeof v === 'string' ? 'word' : 'on';
      if (clockEl.getAttribute('data-state') !== state) clockEl.setAttribute('data-state', state);
      if (rail) toggle(rail, 'is-on', state === 'on');
      if (v == null || v === lastClock) return;
      lastClock = v;
      clockEl.textContent = typeof v === 'string' ? v : fmt.clock(v);
      if (typeof v === 'number' && v !== lastTick) {
        ticks.forEach(function (t, k) { toggle(t, 'is-past', k < v); toggle(t, 'is-now', k === v); });
        lastTick = v;
      }
    }

    function update() {
      var vh = window.innerHeight || 800;
      var line = vh * (mqNarrow.matches ? 0.78 : 0.55);
      var clockV = null;
      for (var c = 0; c < chs.length; c++) {
        var ch = chs[c];
        if (!ch.awake) continue;
        var r = ch.el.getBoundingClientRect();
        var a = 0, p = 0;
        // a step's span runs from its top to the next step's top (cards on mobile have gaps)
        var tops = ch.steps.map(function (s) { return s.getBoundingClientRect(); });
        for (var i = 0; i < ch.n; i++) {
          var top = tops[i].top;
          var span = i < ch.n - 1 ? tops[i + 1].top - top : Math.max(tops[i].height, vh * 0.6);
          if (top <= line) { a = i; p = clamp((line - top) / Math.max(1, span), 0, 1); }
        }
        if (RM) p = 1;
        if (a !== ch.active) {
          ch.steps.forEach(function (s, k) { toggle(s, 'is-active', k === a); });
          ch.el.dataset.activeStep = String(a);
          ch.active = a;
        }
        ch.el.style.setProperty('--chapter-progress', ((a + p) / ch.n).toFixed(3));
        var entered = r.top < vh * 0.9;
        if (ch.dir) { try { ch.dir.apply(a, p, entered); } catch (e) { warn('apply ' + ch.name, e); ch.dir = null; } }
        if (r.top <= line && r.bottom > line && ch.dir) {
          clockV = ch.dir.clock(a, p);
          if (RM && typeof clockV === 'number') clockV = 47;
        }
      }
      setClock(clockV);
    }

    var queued = false;
    function schedule() {
      if (queued) return;
      queued = true;
      C.loop.add(function () { queued = false; update(); return false; });
    }
    window.addEventListener('scroll', schedule, { passive: true });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          chs.forEach(function (ch) {
            if (ch.el === e.target) { ch.awake = e.isIntersecting; toggle(ch.el, 'is-asleep', !e.isIntersecting); }
          });
        });
        schedule();
      }, { rootMargin: '60% 0px 60% 0px' });
      chs.forEach(function (ch) { io.observe(ch.el); });
    }

    var rt = null;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        chs.forEach(function (ch) {
          if (!ch.stage) return;
          var w = ch.stage.clientWidth, hh = ch.stage.clientHeight;
          if (Math.abs(w - ch.sw) > 24 || Math.abs(hh - ch.shh) > 90) { ch.active = -1; build(ch, true); }
        });
        schedule();
      }, 180);
    }, { passive: true });

    C.onReduced(function (r) { RM = r; document.documentElement.classList.toggle('reduced-motion', r); schedule(); });
    if (RM) document.documentElement.classList.add('reduced-motion');
    update();
    // fonts can change stage metrics once; rebuild if the stage box moved a lot
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { window.dispatchEvent(new Event('resize')); });
  }

  ready(function () {
    C = window.SynqCharts; D = window.SYNQ_DATA;
    if (!C) return warn('init', 'SynqCharts missing');
    fmt = C.fmt; h = C.h; el = C.el; clamp = C.clamp;
    RM = C.reduced();
    try { hero(); } catch (e) { warn('hero', e); }
    if (!D || !D.series) return warn('init', 'SYNQ_DATA missing');
    S = D.series; TOT = D.totals; A = D.meta.assumptions || {};
    try { tour(); } catch (e2) { warn('tour', e2); }
  });
}());
