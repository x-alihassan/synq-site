/* SYNQ website v3 - founder card behaviour (owner: founder card). Classic script, no deps.
   Builds the convergence ring around the portrait and the staffing-vs-demand mini chart (inline SVG),
   draws them on when the card scrolls into view, counts the "2 years" chip up, and adds a gentle
   pointer tilt. Under prefers-reduced-motion (or without IntersectionObserver) everything is
   rendered in its final state with no animation. */
(function () {
  'use strict';
  var cards = document.querySelectorAll('[data-founder]');
  if (!cards.length) return;
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(mq && mq.matches) || document.documentElement.classList.contains('reduced-motion'); }

  /* ---------- ring: three parallel lanes that merge into the green line ---------- */
  var C = 108, TRUNK_R = 90;
  function pt(r, deg) { var t = deg * Math.PI / 180; return (C + r * Math.cos(t)).toFixed(1) + ' ' + (C + r * Math.sin(t)).toFixed(1); }
  function lane(r0) {
    var d = '', n = 44, i, t, e;
    for (i = 0; i <= n; i++) {
      t = i / n; e = t * t * (3 - 2 * t);
      d += (i ? 'L' : 'M') + pt(r0 + (TRUNK_R - r0) * e, 120 + 210 * t);
    }
    return d;
  }
  function trunk() {
    var d = '', n = 30, i;
    for (i = 0; i <= n; i++) d += (i ? 'L' : 'M') + pt(TRUNK_R, 330 + 170 * i / n);
    return d;
  }
  function ringSvg() {
    var end = pt(TRUNK_R, 500).split(' ');
    return '<svg viewBox="0 0 216 216" focusable="false" aria-hidden="true">' +
      '<path class="fd-lane fd-lane-1" pathLength="1" d="' + lane(102) + '"/>' +
      '<path class="fd-lane fd-lane-2" pathLength="1" d="' + lane(90) + '"/>' +
      '<path class="fd-lane fd-lane-3" pathLength="1" d="' + lane(78) + '"/>' +
      '<path class="fd-trunk" pathLength="1" d="' + trunk() + '"/>' +
      '<circle class="fd-end" cx="' + end[0] + '" cy="' + end[1] + '" r="4.5"/></svg>';
  }

  /* ---------- mini chart: demand bars vs a stepped staffing line ---------- */
  function chartSvg() {
    var demand = [22, 20, 18, 24, 34, 46, 58, 54, 48, 44, 46, 52, 64, 78, 70, 52];
    var staff = [30, 30, 30, 30, 40, 40, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50];
    var W = 240, H = 90, n = demand.length, bw = W / n, i, bars = '', path = '';
    for (i = 0; i < n; i++) {
      var h = demand[i] / 80 * (H - 8);
      bars += '<rect class="fd-bar" style="--i:' + i + '" x="' + (i * bw + 2).toFixed(1) + '" y="' + (H - h).toFixed(1) + '" width="' + (bw - 4).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2"/>';
      var y = (H - staff[i] / 80 * (H - 8)).toFixed(1);
      path += (i ? 'L' : 'M') + (i * bw).toFixed(1) + ' ' + y + 'L' + ((i + 1) * bw).toFixed(1) + ' ' + y;
    }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" focusable="false" aria-hidden="true">' + bars +
      '<path class="fd-staff" pathLength="1" d="' + path + '"/></svg>';
  }

  /* ---------- count-up ---------- */
  function countUp(el) {
    var to = parseFloat(el.getAttribute('data-count')), t0 = null, dur = 900;
    if (!isFinite(to)) return;
    function step(ts) {
      if (t0 == null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(to * e));
      if (p < 1) requestAnimationFrame(step); else el.textContent = String(to);
    }
    el.textContent = '0';
    requestAnimationFrame(step);
  }

  function enter(card) {
    if (card.classList.contains('is-in')) return;
    card.classList.add('is-in');
    if (!reduced()) {
      var c = card.querySelectorAll('[data-count]');
      for (var i = 0; i < c.length; i++) countUp(c[i]);
    }
  }

  /* ---------- tilt ---------- */
  function tilt(card) {
    var ph = card.querySelector('[data-fd-photo]');
    if (!ph || !window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    ph.addEventListener('pointermove', function (e) {
      if (reduced()) return;
      var r = ph.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      ph.style.setProperty('--ry', (x * 10).toFixed(1) + 'deg');
      ph.style.setProperty('--rx', (-y * 10).toFixed(1) + 'deg');
      ph.style.setProperty('--gx', ((x + .5) * 100).toFixed(0) + '%');
      ph.style.setProperty('--gy', ((y + .5) * 100).toFixed(0) + '%');
    });
    ph.addEventListener('pointerleave', function () {
      ph.style.removeProperty('--ry'); ph.style.removeProperty('--rx');
    });
  }

  var io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { enter(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.3 });
  }
  for (var k = 0; k < cards.length; k++) {
    var card = cards[k];
    var ring = card.querySelector('[data-fd-ring]'), ch = card.querySelector('[data-fd-chart]');
    if (ring) ring.innerHTML = ringSvg();
    if (ch) ch.innerHTML = chartSvg();
    tilt(card);
    if (io && !reduced()) io.observe(card); else enter(card);
  }
})();
