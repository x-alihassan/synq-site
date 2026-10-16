/* SYNQ website v3 - story navigation (single source of truth for the 9-chapter story).
   Builds: the story rail under the header, the entry recap ("Story so far"), the chapter
   footers ("Next: ..."). The rail is the site's only navigation; visited state is in memory only
   (resets on refresh). Classic script, no deps.
   Load after js/site.js. Pages: index.html (chapters 1-7), pilot.html (8), about.html (9), 404.html (none). */
(function () {
  'use strict';

  /* ---------- the story map ---------- */
  /* n=0 is the hero/intro: it is not a rail step but it is part of the recap. */
  /* title / sum are filled from the language pack (refreshCH) */
  var CH = [
    { n: 0, id: 'hero', page: 'index', href: 'index.html' },
    { n: 1, id: 'old-way', page: 'index', href: 'index.html#old-way' },
    { n: 2, id: 'shift', page: 'index', href: 'index.html#shift' },
    { n: 3, id: 'new-way', page: 'index', href: 'index.html#new-way' },
    { n: 4, id: 'proof', page: 'index', href: 'index.html#proof' },
    { n: 5, id: 'simulator', page: 'index', href: 'index.html#simulator' },
    { n: 6, id: 'calculator', page: 'index', href: 'index.html#calculator' },
    { n: 7, id: 'vision', page: 'index', href: 'index.html#vision' },
    { n: 8, id: 'pilot', page: 'pilot', href: 'pilot.html' },
    { n: 9, id: 'about', page: 'about', href: 'about.html' }
  ];
  function T(k, p) { var I = window.SYNQ_I18N; return I ? I.t(k, p) : k; }
  function TK(parts, p) { return T(parts.join(''), p); }   /* dynamic key (prefix + name) */
  function refreshCH() {
    CH.forEach(function (c) { c.title = TK(['story.ch.', c.n, '.title']); c.sum = TK(['story.ch.', c.n, '.sum']); });
  }
  refreshCH();
  var TOTAL = 9;
  var LINKEDIN = 'https://www.linkedin.com/in/3lyiihassan';
  var LI_ICON = '<svg class="li-ico" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false"><path d="M4.5 9h3.2v10.5H4.5zM6.1 4a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM10 9h3v1.5c.5-.9 1.7-1.7 3.3-1.7 3.2 0 3.9 2.1 3.9 4.9v5.8H17v-5.1c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7v5.2H10z"/></svg>';
  /* index.html section ids -> chapter number (faq and cta are the tail of chapter 7) */
  var SECTION_CH = { hero: 0, 'old-way': 1, shift: 2, 'new-way': 3, proof: 4, simulator: 5, calculator: 6, vision: 7, faq: 7, cta: 7 };

  /* ---------- helpers ---------- */
  function el(tag, cls, parent, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    if (parent) parent.appendChild(n);
    return n;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function norm(p) { return p.replace(/\/$/, '/index.html'); }

  var body = document.body;
  var pageKey = (body && body.getAttribute('data-page')) || '';
  if (!pageKey) {
    var base = norm(location.pathname).split('/').pop();
    pageKey = base === 'index.html' || base === '' ? 'home' : base === 'pilot.html' ? 'pilot' : base === 'about.html' ? 'about' : 'other';
  }
  var IS_HOME = pageKey === 'home';
  var PAGE_CH = pageKey === 'pilot' ? 8 : pageKey === 'about' ? 9 : null;   /* fixed chapter on secondary pages */

  /* ---------- state ---------- */
  /* Visited chapters and the recap dismissal live in memory only: a refresh starts the story afresh. */
  var seen = {}, recapDismissed = false;
  function markSeen(n) { if (n == null || seen[n]) return; seen[n] = true; }
  function dismissed() { return recapDismissed; }

  var current = null;     /* null = no chapter (404) ; 0 = hero ; 1..9 */
  var jumping = false;
  var railEl = null, links = [], cLabel = null, prevA = null, nextA = null, panel = null, toggleBtn = null;
  var railListening = false, recapN = null, recapMiss = null;

  function chByHash(hash) {
    var id = (hash || '').replace(/^#/, '');
    if (!id || !Object.prototype.hasOwnProperty.call(SECTION_CH, id)) return null;
    return SECTION_CH[id];
  }

  /* ---------- rail ---------- */
  function buildRail() {
    railEl = document.getElementById('story-rail');
    if (!railEl) return;
    railEl.innerHTML = '';
    var row = el('div', 'wrap sr-row', railEl);
    prevA = el('a', 'sr-nav sr-prev', row, '<span aria-hidden="true">‹</span>');
    toggleBtn = el('button', 'sr-current', row);
    toggleBtn.type = 'button';
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('aria-controls', 'story-rail-list');
    cLabel = el('span', 'sr-label', toggleBtn);
    el('span', 'sr-caret', toggleBtn, '▾').setAttribute('aria-hidden', 'true');
    nextA = el('a', 'sr-nav sr-next', row, '<span aria-hidden="true">›</span>');
    panel = el('ol', 'sr-list', row);
    panel.id = 'story-rail-list';
    links = [];
    CH.slice(1).forEach(function (c) {
      var li = el('li', null, panel);
      var a = el('a', 'sr-step', li);
      a.href = c.href;
      a.setAttribute('data-ch', c.n);
      el('span', 'sr-n', a, c.n).setAttribute('aria-hidden', 'true');
      el('span', 'sr-t', a, esc(c.title));
      el('span', 'st-vh', a, '');
      links.push(a);
    });
    toggleBtn.addEventListener('click', function () { setOpen(toggleBtn.getAttribute('aria-expanded') !== 'true'); });
    panel.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) setOpen(false); });
    if (railListening) return;       /* document listeners are registered once; they read the live railEl/toggleBtn */
    railListening = true;
    document.addEventListener('click', function (e) { if (railEl && !railEl.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && toggleBtn && toggleBtn.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        try { toggleBtn.focus(); } catch (err) { /* ignore */ }
      }
    });
  }
  function setOpen(open) {
    if (!toggleBtn) return;
    toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    railEl.classList.toggle('is-open', open);
  }
  /* kind: 'prev' | 'next' | 'start' | 'replay' */
  function setNav(a, c, kind) {
    if (!c) { a.classList.add('is-off'); a.setAttribute('aria-hidden', 'true'); a.tabIndex = -1; a.removeAttribute('href'); return; }
    a.classList.remove('is-off'); a.removeAttribute('aria-hidden'); a.removeAttribute('tabindex');
    a.href = c.href;
    var label = kind === 'replay' ? T('story.nav.replay') :
      kind === 'start' ? T('story.nav.start') :
      c.n === 0 ? T('story.nav.prevStart') : TK(['story.nav.', kind], { title: c.title });
    a.setAttribute('aria-label', label);
  }
  function renderRail() {
    if (!railEl) return;
    links.forEach(function (a) {
      var n = +a.getAttribute('data-ch');
      var isCur = n === current, isDone = !isCur && !!seen[n];
      a.classList.toggle('is-current', isCur);
      a.classList.toggle('is-done', isDone);
      if (isCur) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
      a.querySelector('.sr-n').textContent = isDone ? '✓' : n;
      a.querySelector('.st-vh').textContent = isCur ? T('story.rail.current') : isDone ? T('story.rail.visited') : '';
    });
    if (current == null || current === 0) {
      cLabel.textContent = T('story.rail.label0', { total: TOTAL });
      setNav(prevA, null, 'prev');
      setNav(nextA, current === 0 ? CH[1] : CH[0], current === 0 ? 'next' : 'start');
    } else {
      cLabel.textContent = T('story.rail.label', { n: current, total: TOTAL, title: CH[current].title });
      setNav(prevA, current === 1 ? CH[0] : CH[current - 1], 'prev');
      setNav(nextA, current === TOTAL ? { n: 0, title: '', href: 'index.html' } : CH[current + 1], current === TOTAL ? 'replay' : 'next');
    }
  }

  function setCurrent(n) {
    if (n === current) return;
    current = n;
    renderRail();
  }

  /* ---------- recap ---------- */
  function removeRecap() { var r = document.getElementById('story-recap'); if (r && r.parentNode) r.parentNode.removeChild(r); }
  function missingBefore(n) {
    var m = [];
    for (var i = 0; i < n; i++) if (!seen[i]) m.push(i);
    return m;
  }
  function showRecap(n, host, missOverride) {
    removeRecap();
    var miss = missOverride || missingBefore(n);
    if (!host || n < 1 || !miss.length || dismissed()) return;
    recapN = n; recapMiss = miss;
    var wrap = el('div', 'wrap story-recap-wrap');
    wrap.id = 'story-recap';
    var card = el('aside', 'story-recap', wrap);
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', T('story.recap.title'));
    var x = el('button', 'sr-x', card, '<span aria-hidden="true">×</span>');
    x.type = 'button';
    x.setAttribute('aria-label', T('story.recap.dismiss'));
    el('p', 'eyebrow', card, esc(T('story.recap.title')));
    el('p', 'sr-lead', card, T('story.recap.lead', { n: n, total: TOTAL, title: esc(CH[n].title) }));
    var ol = el('ol', 'sr-recap-list', card);
    miss.forEach(function (i) {
      var li = el('li', null, ol);
      var a = el('a', null, li);
      a.href = CH[i].href;
      a.innerHTML = '<strong>' + (i === 0 ? esc(CH[0].title) : T('story.recap.item', { n: i, title: esc(CH[i].title) })) + '</strong> <span>' + esc(CH[i].sum) + '</span>';
    });
    var act = el('div', 'sr-actions', card);
    var start = el('a', 'btn btn-primary btn-sm', act, esc(T('story.recap.start')));
    start.href = 'index.html';
    if (n < TOTAL) {
      var nx = el('a', 'btn btn-secondary btn-sm', act, T('story.recap.upNext', { title: esc(CH[n + 1].title) }));
      nx.href = CH[n + 1].href;
    }
    var keep = el('button', 'btn btn-secondary btn-sm', act, esc(T('story.recap.hide')));
    keep.type = 'button';
    function dismiss() { recapDismissed = true; removeRecap(); }
    x.addEventListener('click', dismiss);
    keep.addEventListener('click', dismiss);
    card.addEventListener('keydown', function (e) { if (e.key === 'Escape' || e.key === 'Esc') dismiss(); });
    host.insertBefore(wrap, host.firstChild);
  }
  function hostFor(n) {
    if (IS_HOME) return CH[n] ? document.getElementById(CH[n].id) : null;
    return document.getElementById('main');
  }

  /* ---------- chapter footers ---------- */
  function buildFooters() {
    var host, c;
    if (IS_HOME) {
      for (var n = 1; n <= 7; n++) {
        c = CH[n]; host = document.getElementById(c.id);
        if (!host) continue;
        var nx = CH[n + 1];
        var box = el('div', 'wrap story-next', host);
        box.setAttribute('data-for', c.id);
        var a = el('a', 'sn-link', box);
        a.href = nx.href;
        a.innerHTML = '<span class="sn-kicker">' + esc(T('story.foot.kicker', { n: nx.n, total: TOTAL })) + '</span>' +
          '<span class="sn-title">' + T('story.foot.next', { title: esc(nx.title) }) + '</span>' +
          '<span class="sn-sum">' + esc(nx.sum) + '</span>';
      }
    } else if (PAGE_CH) {
      host = document.getElementById('main');
      if (!host) return;
      var f = el('div', 'wrap story-next story-next--page', host);
      var back = PAGE_CH === 8 ? { href: 'index.html#vision', label: T('story.foot.backStory') } : { href: 'pilot.html', label: T('story.foot.backPilot') };
      var bk = el('a', 'btn btn-secondary', f, esc(back.label));
      bk.href = back.href;
      var send = el('a', 'btn btn-primary', f, LI_ICON + T('story.foot.linkedin', { sr: '<span class="visually-hidden">' + esc(T('story.foot.newTab')) + '</span>' }));
      send.href = LINKEDIN;
      send.target = '_blank';
      send.rel = 'noopener noreferrer';
      if (PAGE_CH === 8) {
        var nn = el('a', 'sn-link', f);
        nn.href = 'about.html';
        nn.innerHTML = '<span class="sn-kicker">' + esc(T('story.foot.kicker', { n: 9, total: TOTAL })) + '</span><span class="sn-title">' + T('story.foot.next', { title: esc(CH[9].title) }) + '</span><span class="sn-sum">' + esc(CH[9].sum) + '</span>';
      } else {
        var rp = el('a', 'sn-link', f);
        rp.href = 'index.html';
        rp.innerHTML = '<span class="sn-kicker">' + esc(T('story.foot.endKicker')) + '</span><span class="sn-title">' + T('story.foot.replay') + '</span><span class="sn-sum">' + esc(T('story.foot.replaySum')) + '</span>';
      }
    }
  }
  function removeFooters() {
    [].slice.call(document.querySelectorAll('.story-next')).forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
  }

  /* ---------- index: scroll tracking + jumps ---------- */
  var settleTimer = null, jumpTarget = null, recapFor = null, holdUntil = 0;
  function settle() {
    clearTimeout(settleTimer);
    settleTimer = null;
    jumping = false;
    var t = jumpTarget; jumpTarget = null;
    if (t == null) return;
    setCurrent(t);
    if (t >= 1) { if (recapFor !== t) showRecap(t, hostFor(t)); recapFor = null; markSeen(t); }
    else markSeen(0);
    renderRail();
  }
  function armSettle(ms) { clearTimeout(settleTimer); settleTimer = setTimeout(settle, ms); }
  function startJump(n) {
    jumping = true; jumpTarget = n;
    setCurrent(n);
    armSettle(500);
  }
  function resolve(a) {
    try {
      var u = new URL(a.getAttribute('href'), location.href);
      if (u.origin !== location.origin && u.protocol !== 'file:') return null;
      if (norm(u.pathname) !== norm(location.pathname)) return null;
      if (!u.hash) return u.search === location.search ? 0 : null;
      var n = chByHash(u.hash);
      return n;
    } catch (e) { return null; }
  }
  function initHome() {
    var secs = [];
    Object.keys(SECTION_CH).forEach(function (id) {
      var s = document.getElementById(id);
      if (s) secs.push({ el: s, n: SECTION_CH[id] });
    });
    if ('IntersectionObserver' in window) {
      var hit = {};
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          for (var i = 0; i < secs.length; i++) if (secs[i].el === e.target) hit[secs[i].el.id] = e.isIntersecting;
        });
        if (jumping || Date.now() < holdUntil) return;
        var best = null;
        secs.forEach(function (s) { if (hit[s.el.id] && (best == null || s.n >= best)) best = s.n; });
        if (best == null) return;
        setCurrent(best);
        markSeen(best);
        renderRail();
      }, { rootMargin: '-40% 0px -59% 0px', threshold: 0 });
      secs.forEach(function (s) { io.observe(s.el); });
    }
    window.addEventListener('scroll', function () { if (jumping) armSettle(160); }, { passive: true });
    window.addEventListener('scrollend', function () { if (jumping) armSettle(40); });

    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var n = resolve(a);
      if (n == null) return;
      recapFor = null;
      if (n === 0) {                       /* "start from the beginning" / The story / brand: go to the top, clear the hash */
        e.preventDefault();
        try { history.replaceState(null, '', location.pathname + location.search); } catch (err) { /* ignore */ }
        removeRecap();
        startJump(0);
        window.scrollTo(0, 0);
        armSettle(500);
        return;
      }
      startJump(n);
    });
    window.addEventListener('hashchange', function () {
      var n = chByHash(location.hash);
      if (n != null) startJump(n);
    });

    /* arrival */
    var arrive = chByHash(location.hash);
    if (arrive == null || arrive === 0) {
      if ((window.pageYOffset || 0) < 200) { current = 0; markSeen(0); }
    } else {
      /* landed on a chapter by hash: show the recap, then keep the chapter top in view while
         late layout (fonts, stage builds) settles, unless the visitor has already taken over */
      var interacted = false;
      ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (ev) {
        window.addEventListener(ev, function () { interacted = true; }, { passive: true, once: true });
      });
      var target = document.getElementById(CH[arrive].id);
      var realign = function () {
        if (interacted || !target) return;
        try { target.scrollIntoView({ behavior: 'instant', block: 'start' }); } catch (e) { target.scrollIntoView(); }
        if (jumping) armSettle(450);
      };
      recapFor = arrive; holdUntil = Date.now() + 1600;
      showRecap(arrive, hostFor(arrive));
      startJump(arrive);
      realign();
      window.addEventListener('load', realign);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(realign);
      setTimeout(realign, 500); setTimeout(realign, 1300);
    }
    renderRail();
  }

  /* ---------- init ---------- */
  function init() {
    if (body) body.setAttribute('data-page', pageKey);
    buildRail();
    buildFooters();
    if (IS_HOME) initHome();
    else if (PAGE_CH) {
      current = PAGE_CH;
      showRecap(PAGE_CH, hostFor(PAGE_CH));
      markSeen(PAGE_CH);
      renderRail();
    } else {
      renderRail();                         /* 404 and others: rail present, no current chapter */
    }
  }

  /* live language switch: chapter titles, rail, footers and (if shown) the recap are rebuilt; state is kept */
  function onLang() {
    refreshCH();
    if (railEl) {
      var wasOpen = !!(toggleBtn && toggleBtn.getAttribute('aria-expanded') === 'true');
      buildRail();
      if (wasOpen) setOpen(true);
      renderRail();
    }
    removeFooters();
    buildFooters();
    if (document.getElementById('story-recap') && recapN != null) showRecap(recapN, hostFor(recapN), recapMiss);
  }
  function boot() {
    var I = window.SYNQ_I18N;
    if (I) { I.whenReady(function () { refreshCH(); init(); I.onChange(onLang); }); }
    else init();
  }

  var api = { chapters: CH, total: TOTAL, current: function () { return current; }, seen: function () { var a = []; for (var k in seen) if (seen[k]) a.push(+k); return a.sort(); } };
  if (window.SYNQ) window.SYNQ.story = api; else window.SYNQ = { story: api };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
