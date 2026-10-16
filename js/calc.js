/* SYNQ savings calculator UI (W-CALC). Renders into #calc-root. ILLUSTRATIVE MODEL. */
(function () {
  'use strict';
  function T(k, p) { var I = window.SYNQ_I18N; return I ? I.t(k, p) : k; }
  var state = null;       /* slider values, kept across language rebuilds */
  var advOpen = false;

  /* The frozen model engine writes its assumption notes in English. Map the fixed sentences to keys. */
  var ASM = [
    [/^Illustrative only: every figure is arithmetic on the numbers you entered, not a forecast or a guarantee\.$/, 'calc.asm.illustrative', []],
    [/^One FTE is (.+) paid hours a month, of which (.+)% is unavailable \(shrinkage\) and staff are busy (.+)% of the remaining time\.$/, 'calc.asm.fte', ['hours', 'shrink', 'occ']],
    [/^Human cost is (.+) per paid hour; AI cost is (.+) per automated outcome\.$/, 'calc.asm.cost', ['human', 'ai']],
    [/^(.+)% of items are assumed fully handled by AI; the rest stay with people\.$/, 'calc.asm.share', ['pct']],
    [/^(.+)% of AI outcomes are assumed to get a human review, each taking (.+)% of a normal handling time\.$/, 'calc.asm.review', ['pct', 'time']],
    [/^Acceptance rates are assumed at (.+)% \(human\) and (.+)% \(AI\)\. Cost per accepted outcome is total cost divided by accepted outcomes\.$/, 'calc.asm.accept', ['human', 'ai']],
    [/^Staffing uses average workload, not an interval-level schedule; it excludes setup, integration, hosting and management costs\.$/, 'calc.asm.staffing', []],
    [/^No quality or satisfaction effects are modelled\. Only time, cost and FTE are shown\.$/, 'calc.asm.quality', []],
    [/^(.+) was adjusted from (.+) to (.+) to stay in the supported range\.$/, 'calc.asm.adjusted', ['name', 'from', 'to']]
  ];
  function trAsm(s) {
    var I = window.SYNQ_I18N;
    if (!I || I.lang() === 'en') return s;
    for (var i = 0; i < ASM.length; i++) {
      var m = ASM[i][0].exec(s);
      if (!m) continue;
      var p = {};
      ASM[i][2].forEach(function (n, k) { p[n] = m[k + 1]; });
      return I.has(ASM[i][1]) ? I.t(ASM[i][1], p) : s;
    }
    return s;
  }

  function start() {
    var root = document.getElementById('calc-root');
    var M = window.SynqModel;
    if (!root || !M || typeof M.scenario !== 'function') return;
    var go = function () { try { init(root, M); } catch (e) { if (window.console) console.warn('calc.js failed', e); } };
    var I = window.SYNQ_I18N;
    if (I) {
      I.whenReady(function () {
        go();
        I.onChange(function () {
          var adv = root.querySelector('.calc-adv');
          if (adv) advOpen = adv.open;
          go();
        });
      });
    } else go();
  }

  function init(root, M) {
    var S = window.SYNQ || {};
    var F = S.fmt || {};
    function group(n, d) {
      var s = Math.abs(n).toFixed(d || 0), p = s.split('.');
      p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return (n < 0 ? '-' : '') + p.join('.');
    }
    var fmt = {
      int: F.int || function (n) { return group(Math.round(n), 0); },
      usd: F.usd || function (n, d) { return (n < 0 ? '-' : '') + '$' + group(Math.abs(n), d === undefined ? 2 : d); },
      pct: F.pct || function (x, d) { return (x * 100).toFixed(d === undefined ? 1 : d) + '%'; },
      hours: F.hours || function (n) { return group(Math.round(n), 0) + ' h'; }
    };
    function reduced() {
      if (typeof S.reducedMotion === 'boolean') return S.reducedMotion;
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    // Slider definitions. key = model input name; scale converts slider value to model value.
    var D = {
      monthlyVolume: 48000, ahtMin: 7, shareAutomated: 18, humanCostPerHour: 9, aiCostPerOutcome: 0.99, /* ILLUSTRATIVE default, not a SYNQ price and not a quote; replace with the pilot-measured figure */
      shrinkage: 30, occupancyTarget: 85, humanReviewShare: 10
    };
    var DEF = M.DEFAULTS || {};
    function pctShow(v) { return T('calc.unit.pct', { v: v.toFixed(0) }); }
    function usdShow(v) { return T('calc.unit.usd', { v: v.toFixed(2) }); }
    var sliders = [
      { key: 'monthlyVolume', label: T('calc.s.monthlyVolume.label'), min: 2000, max: 150000, step: 500, scale: 1,
        show: function (v) { return fmt.int(v); }, note: T('calc.s.monthlyVolume.note') },
      { key: 'ahtMin', label: T('calc.s.ahtMin.label'), min: 2, max: 15, step: 0.5, scale: 1,
        show: function (v) { return T('calc.unit.min', { v: v.toFixed(1) }); }, note: T('calc.s.ahtMin.note') },
      { key: 'shareAutomated', label: T('calc.s.shareAutomated.label'), min: 0, max: 85, step: 1, scale: 0.01,
        show: pctShow, note: T('calc.s.shareAutomated.note') },
      { key: 'humanCostPerHour', label: T('calc.s.humanCostPerHour.label'), min: 3, max: 30, step: 0.5, scale: 1,
        show: usdShow, note: T('calc.s.humanCostPerHour.note') },
      { key: 'aiCostPerOutcome', label: T('calc.s.aiCostPerOutcome.label'), min: 0.25, max: 3, step: 0.01, scale: 1,
        show: usdShow, srcNote: true }
    ];
    var adv = [
      { key: 'shrinkage', label: T('calc.s.shrinkage.label'), min: 15, max: 45, step: 1, scale: 0.01,
        show: pctShow, note: T('calc.s.shrinkage.note') },
      { key: 'occupancyTarget', label: T('calc.s.occupancyTarget.label'), min: 60, max: 95, step: 1, scale: 0.01,
        show: pctShow, note: T('calc.s.occupancyTarget.note') },
      { key: 'humanReviewShare', label: T('calc.s.humanReviewShare.label'), min: 0, max: 100, step: 5, scale: 0.01,
        show: pctShow, note: T('calc.s.humanReviewShare.note') }
    ];
    var all = sliders.concat(adv);
    if (!state) { state = {}; all.forEach(function (s) { state[s.key] = D[s.key]; }); }

    function el(tag, cls, html) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (html !== undefined) e.innerHTML = html;
      return e;
    }
    function sliderHTML(s) {
      var id = 'calc-' + s.key;
      return '<div class="calc-field">' +
        '<div class="calc-field-head"><label for="' + id + '">' + s.label + '</label>' +
        '<output class="num calc-val" id="' + id + '-out" for="' + id + '"></output></div>' +
        '<input type="range" id="' + id + '" min="' + s.min + '" max="' + s.max + '" step="' + s.step + '" value="' + state[s.key] + '" data-key="' + s.key + '" aria-describedby="' + id + '-note">' +
        '<p class="calc-note" id="' + id + '-note">' +
        (s.srcNote ? T('calc.s.aiCostPerOutcome.src') : s.note) +
        '</p></div>';
    }

    root.classList.add('calc');
    root.innerHTML =
      '<div class="calc-panel card">' +
      '<p><span class="stamp">' + T('common.stamp') + '</span></p>' +
      '<p class="calc-summary" id="calc-summary" aria-live="polite"></p>' +
      '<div class="calc-grid">' +
        '<form class="calc-inputs" onsubmit="return false" aria-label="' + T('calc.inputsLabel') + '">' +
          '<h3 class="calc-h">' + T('calc.h.desk') + '</h3>' +
          sliders.map(sliderHTML).join('') +
          '<details class="calc-adv"' + (advOpen ? ' open' : '') + '><summary>' + T('calc.advanced') + '</summary>' + adv.map(sliderHTML).join('') +
          '<p class="calc-note">' + T('calc.fixedNote') + '</p></details>' +
          '<button type="button" class="btn btn-secondary btn-sm" id="calc-reset">' + T('calc.reset') + '</button>' +
        '</form>' +
        '<div class="calc-outputs">' +
          '<section class="calc-group" aria-labelledby="calc-g-time"><h3 class="calc-h" id="calc-g-time">' + T('calc.h.time') + '</h3>' +
            '<dl class="calc-stats"><div><dt>' + T('calc.o.hoursFreed') + '</dt><dd class="num calc-big" data-o="hoursFreed"></dd></div></dl></section>' +
          '<section class="calc-group" aria-labelledby="calc-g-lab"><h3 class="calc-h" id="calc-g-lab">' + T('calc.h.labour') + '</h3>' +
            '<dl class="calc-stats">' +
            '<div><dt>' + T('calc.o.fteOld') + '</dt><dd class="num calc-big" data-o="fteOld"></dd></div>' +
            '<div><dt>' + T('calc.o.fteNew') + '</dt><dd class="num calc-big" data-o="fteNew"></dd></div>' +
            '<div><dt>' + T('calc.o.fteFreed') + '</dt><dd class="num calc-big" data-o="fteFreed"></dd></div></dl>' +
            '<p class="calc-note">' + T('calc.fteNote') + '</p></section>' +
          '<section class="calc-group" aria-labelledby="calc-g-mon"><h3 class="calc-h" id="calc-g-mon">' + T('calc.h.money') + '</h3>' +
            '<dl class="calc-stats">' +
            '<div><dt>' + T('calc.o.costOld') + '</dt><dd class="num calc-big" data-o="costOld"></dd></div>' +
            '<div><dt>' + T('calc.o.costNew') + '</dt><dd class="num calc-big" data-o="costNew"></dd></div>' +
            '<div><dt>' + T('calc.o.savings') + '</dt><dd class="num calc-big" data-o="savings"></dd></div>' +
            '<div><dt>' + T('calc.o.cpaoOld') + '</dt><dd class="num calc-big" data-o="cpaoOld"></dd></div>' +
            '<div><dt>' + T('calc.o.cpaoNew') + '</dt><dd class="num calc-big" data-o="cpaoNew"></dd></div></dl>' +
            '<p class="calc-warn" id="calc-warn" hidden>' + T('calc.warn') + '</p></section>' +
          '<figure class="calc-viz"><svg id="calc-svg" class="calc-svg" role="img" aria-labelledby="calc-svg-t" viewBox="0 0 420 200" preserveAspectRatio="xMidYMid meet">' +
            '<title id="calc-svg-t">' + T('calc.svg.title') + '</title></svg>' +
            '<figcaption class="calc-note">' + T('calc.legend', { kh: '<span class="calc-key calc-key--h" aria-hidden="true"></span>', ka: '<span class="calc-key calc-key--a" aria-hidden="true"></span>' }) + '</figcaption></figure>' +
        '</div>' +
      '</div>' +
      '<div class="calc-blocks">' +
        '<section class="calc-block"><h3 class="calc-h">' + T('calc.h.assume') + '</h3><div id="calc-assume"></div></section>' +
        '<section class="calc-block"><h3 class="calc-h">' + T('calc.h.pilot') + '</h3>' +
          '<p>' + T('calc.pilot.intro') + '</p>' +
          '<ul><li>' + T('calc.pilot.cx') + '</li><li>' + T('calc.pilot.ax') + '</li><li>' + T('calc.pilot.esc') + '</li><li>' + T('calc.pilot.qa') + '</li><li>' + T('calc.pilot.time') + '</li></ul></section>' +
      '</div></div>';

    var q = function (s) { return root.querySelector(s); };
    var outs = {};
    [].forEach.call(root.querySelectorAll('[data-o]'), function (n) { outs[n.getAttribute('data-o')] = n; });
    var svg = q('#calc-svg'), summary = q('#calc-summary'), warn = q('#calc-warn');
    var NS = 'http://www.w3.org/2000/svg';

    // Build the SVG once: two rows (FTE, cost), two bars each.
    var rows = [
      { id: 'fte', y: 8, label: T('calc.svg.fte') },
      { id: 'cost', y: 102, label: T('calc.svg.cost') }
    ];
    var bars = {};
    function se(tag, attrs, parent, text) {
      var e = document.createElementNS(NS, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      if (text !== undefined) e.textContent = text;
      (parent || svg).appendChild(e);
      return e;
    }
    rows.forEach(function (r) {
      se('text', { x: 0, y: r.y + 12, 'class': 'calc-svg-h' }, null, r.label);
      [['old', T('calc.svg.human'), r.y + 30, 'var(--lane-human)'], ['new', T('calc.svg.ai'), r.y + 66, 'var(--lane-ai)']].forEach(function (b) {
        se('text', { x: 0, y: b[2], 'class': 'calc-svg-l' }, null, b[1]);
        se('rect', { x: 0, y: b[2] + 4, width: 300, height: 16, rx: 4, fill: 'var(--surface-2)' });
        var rect = se('rect', { x: 0, y: b[2] + 4, width: 300, height: 16, rx: 4, fill: b[3], 'class': 'calc-bar' });
        rect.style.transformOrigin = '0 0'; rect.style.transformBox = 'view-box';
        var t = se('text', { x: 306, y: b[2] + 17, 'class': 'calc-svg-v' });
        bars[r.id + b[0]] = { rect: rect, val: t };
      });
    });
    svg.setAttribute('viewBox', '0 0 420 200');

    function setBar(b, frac, instant) {
      frac = Math.max(0, Math.min(1, frac));
      b.rect.style.transition = (instant || reduced()) ? 'none' : 'transform var(--dur-2) var(--ease-out)';
      b.rect.style.transform = 'scaleX(' + frac.toFixed(4) + ')';
    }

    function readInputs() {
      var o = {};
      all.forEach(function (s) { o[s.key] = state[s.key] * s.scale; });
      return o;
    }
    var first = true;
    function render() {
      var sc = M.scenario(readInputs());
      var n = sc.new, o = sc.old;
      all.forEach(function (s) { q('#calc-' + s.key + '-out').textContent = s.show(state[s.key]); });
      outs.hoursFreed.textContent = fmt.hours(sc.hoursFreed);
      outs.fteOld.textContent = o.fteRequired.toFixed(1);
      outs.fteNew.textContent = n.fteRequired.toFixed(1);
      outs.fteFreed.textContent = sc.fteFreed.toFixed(1);
      outs.costOld.textContent = fmt.usd(o.monthlyCost, 0);
      outs.costNew.textContent = fmt.usd(n.monthlyCost, 0);
      outs.savings.textContent = fmt.usd(sc.monthlySavings, 0);
      outs.cpaoOld.textContent = fmt.usd(o.costPerAcceptedOutcome, 2);
      outs.cpaoNew.textContent = fmt.usd(n.costPerAcceptedOutcome, 2);
      var cheaper = sc.monthlySavings > 0;
      warn.hidden = sc.monthlySavings >= 0;
      var line = cheaper
        ? T('calc.sum.saves', { amt: fmt.usd(sc.monthlySavings, 0), fte: sc.fteFreed.toFixed(1) })
        : (sc.monthlySavings < 0 ? T('calc.sum.humanCheaper', { amt: fmt.usd(-sc.monthlySavings, 0) }) : T('calc.sum.same'));
      if (summary.textContent !== line) summary.textContent = line;

      var mf = Math.max(o.fteRequired, n.fteRequired) || 1, mc = Math.max(o.monthlyCost, n.monthlyCost) || 1;
      setBar(bars.fteold, o.fteRequired / mf, first); setBar(bars.ftenew, n.fteRequired / mf, first);
      setBar(bars.costold, o.monthlyCost / mc, first); setBar(bars.costnew, n.monthlyCost / mc, first);
      bars.fteold.val.textContent = o.fteRequired.toFixed(1); bars.ftenew.val.textContent = n.fteRequired.toFixed(1);
      bars.costold.val.textContent = fmt.usd(o.monthlyCost, 0); bars.costnew.val.textContent = fmt.usd(n.monthlyCost, 0);
      svg.querySelector('title').textContent = T('calc.svg.desc', {
        fo: o.fteRequired.toFixed(1), fn: n.fteRequired.toFixed(1), co: fmt.usd(o.monthlyCost, 0), cn: fmt.usd(n.monthlyCost, 0) });
      renderAssume(sc);
      first = false;
    }

    var assumeEl = q('#calc-assume'), assumeKey = '';
    function renderAssume(sc) {
      var v = sc.inputs;
      var key = JSON.stringify(v);
      if (key === assumeKey) return;
      assumeKey = key;
      function li(s) { return '<li>' + s + '</li>'; }
      var html = '<h4>' + T('calc.f.title') + '</h4><ul class="calc-formulas">' +
        li(T('calc.f.humanOld')) +
        li(T('calc.f.aiItems')) +
        li(T('calc.f.reviewed')) +
        li(T('calc.f.humanNew', { factor: v.reviewTimeFactor })) +
        li(T('calc.f.productive', { hpf: v.hoursPerFte, shr: v.shrinkage.toFixed(2), occ: v.occupancyTarget.toFixed(2), prod: (v.hoursPerFte * (1 - v.shrinkage) * v.occupancyTarget).toFixed(1) })) +
        li(T('calc.f.fte')) +
        li(T('calc.f.humanCost')) +
        li(T('calc.f.aiCost')) +
        li(T('calc.f.monthly')) +
        li(T('calc.f.cpao')) +
        li(T('calc.f.freed')) + '</ul>' +
        '<h4>' + T('calc.notes.title') + '</h4><ul>' + sc.assumptions.map(function (a) { return '<li>' + trAsm(a).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</li>'; }).join('') + '</ul>' +
        '<h4>' + T('calc.not.title') + '</h4><ul>' + li(T('calc.not.1')) + li(T('calc.not.2')) + li(T('calc.not.3')) + '</ul>';
      assumeEl.innerHTML = html;
    }

    var raf = 0;
    function schedule() { if (raf) return; raf = (window.requestAnimationFrame || setTimeout)(function () { raf = 0; render(); }); }
    if (root.__calcInput) root.removeEventListener('input', root.__calcInput);
    root.__calcInput = function (e) {
      var t = e.target;
      if (!t || t.type !== 'range') return;
      state[t.getAttribute('data-key')] = parseFloat(t.value);
      schedule();
    };
    root.addEventListener('input', root.__calcInput);
    q('#calc-reset').addEventListener('click', function () {
      all.forEach(function (s) { state[s.key] = D[s.key]; q('#calc-' + s.key).value = D[s.key]; });
      schedule();
    });
    render();
    var advEl = q('.calc-adv');
    if (advEl) advEl.addEventListener('toggle', function () { advOpen = advEl.open; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
