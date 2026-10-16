/*!
 * SYNQ simulator UI — renders the decision-trace demo into #sim-root.
 * SIMULATED: scripted rules (window.SynqEngine), no AI model is called,
 * fictional merchant, orders and policy (window.SynqScenarios).
 */
(function () {
  'use strict';

  var TODAY = '2026-10-14';
  var TICK = 150;
  var STAMP = 'SIMULATED · scripted rules · no AI model is called · fictional merchant & policy';   /* JSON notice only; the UI uses T('sim.stamp') */
  var CHIPS = ['policy', 'money', 'log'];
  function T(k, p) { var I = window.SYNQ_I18N; return I ? I.t(k, p) : k; }
  function TK(parts, p) { return T(parts.join(''), p); }   /* dynamic key (prefix + name) */
  function isEn() { var I = window.SYNQ_I18N; return !I || I.lang() === 'en'; }
  /* translate a data word (intent, category, condition, decision, flag) when the pack knows it */
  function word(prefix, x) {
    var I = window.SYNQ_I18N;
    return I && I.has(prefix + x) ? I.t(prefix + x) : String(x);
  }

  /* ---- Arabic layer for strings produced by the frozen engine (engine/simulator-engine.js) ----
     Each entry: [regex, key, param names]. A trailing '*' on a name translates the captured word through
     sim.<name>.<word>. Unmatched strings pass through unchanged. English is never touched. */
  var ENG = [
    [/^Understand request$/, 'sim.eng.label.intent', []],
    [/^Gather order context$/, 'sim.eng.label.context', []],
    [/^Check policy rules$/, 'sim.eng.label.policy', []],
    [/^Check permissions$/, 'sim.eng.label.permission', []],
    [/^Execute or route to client human$/, 'sim.eng.label.execute', []],
    [/^Verify outcome$/, 'sim.eng.label.verify', []],
    [/^Write audit trail$/, 'sim.eng.label.audit', []],
    [/^Classified as "(\w+)" by deterministic keyword rules \(EN \+ AR\)\.$/, 'sim.eng.classified', ['intent*']],
    [/^Risk flag present on case\.$/, 'sim.eng.riskFlag', []],
    [/^Fraud signal overrides all other rules\.$/, 'sim.eng.fraudOverride', []],
    [/^VIP complaint flag present\.$/, 'sim.eng.vipFlag', []],
    [/^VIP complaints are never handled automatically\.$/, 'sim.eng.vipNever', []],
    [/^Cannot pick a workflow without a clear intent\.$/, 'sim.eng.noIntent', []],
    [/^No matching order found\.$/, 'sim.eng.noOrder', []],
    [/^Order belongs to a different customer\.$/, 'sim.eng.otherCustomer', []],
    [/^Request date or delivery date is absent\.$/, 'sim.eng.noDate', []],
    [/^Order facts are invalid or inconsistent\.$/, 'sim.eng.invalidFacts', []],
    [/^Order (\S+): (\d+) (\S+), (\S+), (\S+), delivered (-?\d+) day\(s\) ago\.$/, 'sim.eng.orderContext', ['id', 'amount', 'cur', 'cat*', 'cond*', 'days']],
    [/^(-?\d+) days > (\d+)-day window\.$/, 'sim.eng.outsideWindow', ['days', 'max']],
    [/^Category "(.+)" is excluded\.$/, 'sim.eng.catExcluded', ['cat*']],
    [/^Item condition "(.+)" is not unopened\.$/, 'sim.eng.condNotUnopened', ['cond*']],
    [/^Window, category and condition rules all pass\.$/, 'sim.eng.rulesPass', []],
    [/^Refund above (\d+): AI may not act; senior approval needed\.$/, 'sim.eng.refundSenior', ['n']],
    [/^Refunds are never AI-executable; client human approval needed\.$/, 'sim.eng.refundHuman', []],
    [/^(\d+) exceeds the (\d+) auto limit\.$/, 'sim.eng.overLimit', ['amount', 'max']],
    [/^AI is permitted to initiate (\w+) at (\d+) (\S+)\.$/, 'sim.eng.permitted', ['intent*', 'amount', 'cur']],
    [/^AI created the (\w+) record and scheduled a pickup \(synthetic\)\.$/, 'sim.eng.created', ['intent*']],
    [/^Return record and pickup both confirmed present\.$/, 'sim.eng.confirmed', []],
    [/^Not reached\.$/, 'sim.eng.notReached', []],
    [/^No action taken; asked for missing information\.$/, 'sim.eng.noActionInfo', []],
    [/^No external action; routed to client human \((\w+)\)\.$/, 'sim.eng.routedDecision', ['decision*']],
    [/^No action executed, nothing to verify\.$/, 'sim.eng.nothingToVerify', []],
    [/^(\d+) events recorded \(append-only\)\.$/, 'sim.eng.eventsRecorded', ['n']],
    /* outcomes */
    [/^Escalated to client fraud team\. No action taken\.$/, 'sim.eng.out.fraud', []],
    [/^Escalated to client account owner\. No action taken\.$/, 'sim.eng.out.vip', []],
    [/^Routed to client human for clarification\. No action taken\.$/, 'sim.eng.out.clarify', []],
    [/^Asked customer for the order number\. No action taken\.$/, 'sim.eng.out.askOrder', []],
    [/^Escalated to client human\. No action taken\.$/, 'sim.eng.out.escalated', []],
    [/^Asked for the missing date\. No action taken\.$/, 'sim.eng.out.askDate', []],
    [/^Approval request sent to client human\. No refund issued\.$/, 'sim.eng.out.refundHuman', []],
    [/^Approval request sent to client senior human\. No refund issued\.$/, 'sim.eng.out.refundSenior', []],
    [/^Approval request sent to client human\. No action taken\.$/, 'sim.eng.out.approvalSent', []],
    [/^Verified: synthetic (\w+) created and pickup scheduled by AI\.$/, 'sim.eng.out.verified', ['intent*']],
    /* audit details */
    [/^Synthetic request received$/, 'sim.eng.audit.received', []],
    [/^(return|exchange|refund|unknown)$/, 'sim.eng.audit.intent', ['intent*']],
    [/^(-?\d+) days after delivery; (\d+) (\S+)$/, 'sim.eng.audit.eligibility', ['days', 'amount', 'cur']],
    [/^No external action; routed to client human$/, 'sim.eng.audit.routed', []],
    [/^Trail sealed$/, 'sim.eng.audit.sealed', []],
    [/^Policy and permissions allow fictional initiation$/, 'sim.eng.audit.allowed', []],
    [/^Offline (\w+) initiation only$/, 'sim.eng.audit.offline', ['intent*']],
    [/^Synthetic return\/exchange record created$/, 'sim.eng.audit.returnCreated', []],
    [/^Synthetic pickup record scheduled$/, 'sim.eng.audit.pickup', []],
    [/^Both synthetic records present; policy and route valid$/, 'sim.eng.audit.verified', []],
    [/^(approve|reject) \(simulated reviewer\)$/, 'sim.eng.audit.humanDecision', ['decision*']],
    [/^Approval recorded; no money moves in this demo$/, 'sim.eng.audit.refundApproved', []],
    [/^Synthetic (\w+) record created after human approval$/, 'sim.eng.audit.createdAfter', ['intent*']],
    [/^Both synthetic records present; approved by human$/, 'sim.eng.audit.verifiedHuman', []],
    [/^Rejected by human; no external action$/, 'sim.eng.audit.rejected', []]
  ];
  function trEngine(s) {
    var I = window.SYNQ_I18N;
    if (!I || I.lang() === 'en' || s == null) return s;
    s = String(s);
    for (var i = 0; i < ENG.length; i++) {
      var m = ENG[i][0].exec(s);
      if (!m || !I.has(ENG[i][1])) continue;
      var p = {};
      ENG[i][2].forEach(function (n, k) {
        var v = m[k + 1];
        if (n.charAt(n.length - 1) === '*') { n = n.slice(0, -1); v = word('sim.' + n + '.', v); }
        p[n] = v;
      });
      return I.t(ENG[i][1], p);
    }
    return s;
  }
  function reasonText(E, code) {
    var I = window.SYNQ_I18N;
    return I && I.has('sim.reason.' + code) ? TK(['sim.reason.', code]) : (E.REASON_TEXT[code] || code);
  }
  var STEP_KEY = { intent: 'INTENT', context: 'CONTEXT', policy: 'POLICY', permission: 'PERMISSION', execute: 'EXECUTE', verify: 'VERIFY', audit: 'AUDIT' };
  var RULE_REF = {
    'eligible-auto': 'policy.auto_action_max=500', 'approval-threshold': 'policy.auto_action_max=500',
    'refund-approval': 'policy.refunds=human_approval', 'senior-refund-approval': 'policy.senior_refund_above=1000',
    'outside-window': 'policy.return_window_days=14', 'excluded-category': 'policy.returnable_categories',
    'used-item': 'policy.allowed_item_condition=unopened', 'missing-order': 'policy.always_human.order_missing',
    'missing-date': 'policy.always_human.missing_dates', 'vip-complaint': 'policy.always_human.vip_complaint',
    'fraud-signal': 'policy.always_human.fraud_signal', 'ambiguous-request': 'policy.always_human.ambiguous',
    'invalid-order-facts': 'policy.always_human.invalid_facts', 'order-customer-mismatch': 'policy.always_human.owner_mismatch'
  };
  var KW = { 'return': ['return', 'إرجاع'], exchange: ['exchange', 'استبدال'], refund: ['refund', 'استرداد'] };

  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function reduced() {
    if (window.SYNQ && typeof window.SYNQ.reducedMotion === 'boolean') return window.SYNQ.reducedMotion;
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function h(tag, cls, parent, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dayDiff(a, b) { return Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000); }
  function intInt(n) { return Number(n).toLocaleString('en-US'); }
  function simTs(seq) { var s = 9 * 3600 + seq * 2; return TODAY + 'T' + pad2(Math.floor(s / 3600)) + ':' + pad2(Math.floor(s / 60) % 60) + ':' + pad2(s % 60) + 'Z'; }

  ready(function () {
    var root = document.getElementById('sim-root');
    if (!root) return;
    var go = function () { try { init(root); } catch (e) { if (window.console) console.warn('[SYNQ sim] init', e); } };
    var I = window.SYNQ_I18N;
    if (I) { I.whenReady(function () { go(); I.onChange(go); }); } else go();
  });

  function init(root) {
    var E = window.SynqEngine, SC = window.SynqScenarios;
    if (!E || !SC) { root.textContent = T('sim.loadError'); return; }
    var P = E.POLICY;
    var orders = SC.map(function (s) { return s.order; });

    root.textContent = '';
    var wrap = h('div', 'sim', root);

    /* --- header: stamp, policy link, safety chips --- */
    var top = h('div', 'sim-top', wrap);
    h('span', 'stamp stamp--sim sim-stamp', top, T('sim.stamp'));
    var polBtn = h('button', 'sim-link', top, T('sim.policyLink'));
    polBtn.type = 'button';
    polBtn.setAttribute('aria-haspopup', 'dialog');
    var chipsUl = h('ul', 'sim-chips', wrap);
    chipsUl.setAttribute('aria-label', T('sim.chipsLabel'));
    var chips = {};
    CHIPS.forEach(function (c) {
      var li = h('li', 'sim-chip', chipsUl);
      h('span', 'sim-chip-g', li, '✓').setAttribute('aria-hidden', 'true');
      h('span', null, li, TK(['sim.chip.', c]));
      var sr = h('span', 'visually-hidden', li, T('sim.chip.off'));
      chips[c] = { li: li, sr: sr };
    });

    var grid = h('div', 'sim-grid', wrap);

    /* --- column 1: request --- */
    var c1 = h('section', 'sim-col sim-req', grid);
    c1.setAttribute('aria-labelledby', 'sim-h-req');
    var h1 = h('h3', 'sim-h', c1, T('sim.h.request')); h1.id = 'sim-h-req';
    var presets = h('div', 'sim-presets', c1);
    presets.setAttribute('role', 'group');
    presets.setAttribute('aria-label', T('sim.presetsLabel'));
    /* the text shown (and passed to the engine) for a preset: the scenario's own text in English, the pack's in Arabic */
    function ptext(s) { return isEn() ? s.text : TK(['sim.preset.', s.id, '.text']); }
    var presetBtns = SC.map(function (s) {
      var b = h('button', 'sim-preset' + (s.risky ? ' is-risky' : ''), presets);
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      var t = h('span', 'sim-preset-t', b, TK(['sim.preset.', s.id, '.title']));
      if (s.risky) h('span', 'sim-preset-risk', t, T('sim.risky'));
      var q = h('span', 'sim-preset-q', b, '“'); h('bdi', null, q, ptext(s)); q.appendChild(document.createTextNode('”'));
      var mp = { id: s.order.order_id, amount: intInt(s.order.amount), cur: s.order.currency, day: dayDiff(s.today, s.order.delivered_on) };
      if (s.customer.flags.length) {
        mp.flags = s.customer.flags.map(function (f) { return TK(['sim.flag.', f]); }).join(T('common.commaSep'));
        h('span', 'sim-preset-m num', b, T('sim.preset.metaFlags', mp));
      } else h('span', 'sim-preset-m num', b, T('sim.preset.meta', mp));
      b.addEventListener('click', function () { loadPreset(s); });
      return b;
    });

    var form = h('form', 'sim-form', c1);
    form.setAttribute('novalidate', '');
    var lt = h('label', 'sim-label', form, T('sim.form.own')); lt.htmlFor = 'sim-text';
    var ta = h('textarea', 'sim-text', form);
    ta.id = 'sim-text'; ta.rows = 3; ta.maxLength = 280; ta.setAttribute('dir', 'auto');
    ta.placeholder = T('sim.form.placeholder');
    ta.setAttribute('aria-describedby', 'sim-count sim-hint');
    var count = h('span', 'sim-count num', form, T('sim.count', { n: 0, max: 280 })); count.id = 'sim-count';
    var lo = h('label', 'sim-label', form, T('sim.form.order')); lo.htmlFor = 'sim-order';
    var sel = h('select', 'sim-select', form); sel.id = 'sim-order';
    orders.forEach(function (o) {
      var op = h('option', null, sel, T('sim.opt.order', { id: o.order_id, amount: intInt(o.amount), cur: o.currency, cat: word('sim.cat.', o.category), day: dayDiff(TODAY, o.delivered_on) }));
      op.value = o.order_id;
    });
    h('option', null, sel, T('sim.opt.none')).value = '';
    var fs = h('fieldset', 'sim-flags', form);
    h('legend', 'sim-label', fs, T('sim.form.flags'));
    function flag(id, label) {
      var l = h('label', 'sim-check', fs);
      var c = h('input', null, l); c.type = 'checkbox'; c.id = id;
      h('span', null, l, label);
      return c;
    }
    var fFraud = flag('sim-f-fraud', T('sim.form.fraud'));
    var fVip = flag('sim-f-vip', T('sim.form.vip'));
    h('p', 'sim-note', fs, T('sim.form.flagsNote'));
    var hint = h('p', 'sim-hint', form); hint.id = 'sim-hint'; hint.setAttribute('aria-live', 'polite');
    var runBtn = h('button', 'btn btn-primary sim-run', form, T('sim.run')); runBtn.type = 'submit';

    /* --- column 2: trace --- */
    var c2 = h('section', 'sim-col sim-trace', grid);
    c2.setAttribute('aria-labelledby', 'sim-h-trace');
    var th = h('div', 'sim-col-head', c2);
    var h2 = h('h3', 'sim-h', th, T('sim.h.trace')); h2.id = 'sim-h-trace';
    var skip = h('button', 'sim-link sim-skip', th, T('sim.skip')); skip.type = 'button'; skip.hidden = true;
    var lines = h('ol', 'sim-lines', c2);
    var idle = h('p', 'sim-idle', c2, T('sim.idle'));

    /* --- column 3: outcome --- */
    var c3 = h('section', 'sim-col sim-out', grid);
    c3.setAttribute('aria-labelledby', 'sim-h-out');
    var h3 = h('h3', 'sim-h', c3, T('sim.h.outcome')); h3.id = 'sim-h-out';
    var out = h('div', 'sim-outcome', c3);
    out.setAttribute('aria-live', 'polite');
    var outIdle = h('div', 'sim-out-idle', out);
    var mark = h('img', 'sim-mark', outIdle); mark.src = 'assets/synq_mark_color.svg'; mark.alt = ''; mark.width = 48; mark.height = 48;
    h('p', null, outIdle, T('sim.out.idle'));
    var audit = h('details', 'sim-audit', c3);
    var auditSum = h('summary', null, audit, T('sim.audit.title'));
    var auditList = h('ol', 'sim-audit-list num', audit);
    var dl = h('button', 'btn btn-secondary btn-sm sim-dl', c3, T('sim.download')); dl.type = 'button'; dl.disabled = true;

    /* --- policy drawer --- */
    var dlg = h('dialog', 'sim-policy', wrap);
    dlg.setAttribute('aria-labelledby', 'sim-pol-h');
    var dh = h('div', 'sim-policy-head', dlg);
    var ph = h('h3', 'sim-h', dh, T('sim.pol.title')); ph.id = 'sim-pol-h';
    var close = h('button', 'icon-btn sim-close', dh, '✕'); close.type = 'button'; close.setAttribute('aria-label', T('sim.pol.close'));
    h('p', 'sim-note', dlg, T('sim.pol.note'));
    var pt = h('table', 'sim-policy-table', dlg);
    var ptb = h('tbody', null, pt);
    var senior = intInt(P.senior_refund_above_local_currency), autoMax = intInt(P.auto_action_max_local_currency_inclusive);
    [[T('sim.pol.markets'), T('sim.pol.markets.v')],
      [T('sim.pol.window'), T('sim.pol.window.v', { n: P.return_window_days_inclusive })],
      [T('sim.pol.returnable'), T('sim.pol.returnable.v', { cats: P.returnable_categories.map(function (c) { return word('sim.cat.', c); }).join(T('common.commaSep')), cond: word('sim.cond.', P.allowed_item_condition) })],
      [T('sim.pol.auto'), T('sim.pol.auto.v', { n: autoMax })],
      [T('sim.pol.approval'), T('sim.pol.approval.v', { n: autoMax })],
      [T('sim.pol.refunds'), T('sim.pol.refunds.v', { n: senior })],
      [T('sim.pol.always'), T('sim.pol.always.v')],
      [T('sim.pol.date'), TODAY]].forEach(function (r) {
      var tr = h('tr', null, ptb); var x = h('th', null, tr, r[0]); x.scope = 'row'; h('td', null, tr, r[1]);
    });
    function openPolicy() {
      if (typeof dlg.showModal === 'function') dlg.showModal(); else { dlg.setAttribute('open', ''); close.focus(); }
    }
    function closePolicy() { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); polBtn.focus(); }
    polBtn.addEventListener('click', openPolicy);
    close.addEventListener('click', closePolicy);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) closePolicy(); });

    /* --- state --- */
    var run = null, token = 0, current = null;

    function setPressed(s) { presetBtns.forEach(function (b, i) { b.setAttribute('aria-pressed', SC[i] === s ? 'true' : 'false'); }); }
    function updateCount() {
      count.textContent = T('sim.count', { n: ta.value.length, max: 280 });
      runBtn.disabled = !!run || !ta.value.trim();
      if (!ta.value.trim()) setHint(T('sim.hint.empty'), false);
      else if (hint.getAttribute('data-k') === 'empty') setHint('', false);
    }
    function setHint(t, warn) { hint.textContent = t; hint.setAttribute('data-k', t ? (warn ? 'warn' : 'empty') : ''); }

    function loadPreset(s) {
      var text = ptext(s);       /* what is shown is what the engine reads */
      ta.value = text;
      sel.value = s.order.order_id;
      fFraud.checked = s.customer.flags.indexOf('fraud_signal') !== -1;
      fVip.checked = s.customer.flags.indexOf('vip_complaint') !== -1;
      setPressed(s);
      updateCount();
      start({ id: s.id, input: { text: text, customer: s.customer, order: s.order, today: s.today }, notes: [] });
    }

    ta.addEventListener('input', function () { setPressed(null); updateCount(); });
    sel.addEventListener('change', function () { setPressed(null); });
    fFraud.addEventListener('change', function () { setPressed(null); });
    fVip.addEventListener('change', function () { setPressed(null); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = ta.value.trim();
      if (!text) { setHint(T('sim.hint.empty'), false); ta.focus(); return; }
      var order = null;
      for (var i = 0; i < orders.length; i++) if (orders[i].order_id === sel.value) order = orders[i];
      var flags = [];
      if (fFraud.checked) flags.push('fraud_signal');
      if (fVip.checked) flags.push('vip_complaint');
      var notes = [];
      var m = text.match(/SYN-ORDER-\d{4}/i);
      if (m && order && m[0].toUpperCase() !== order.order_id) notes.push(T('sim.note.mismatch', { mentioned: m[0].toUpperCase(), order: order.order_id }));
      if (m && !order) notes.push(T('sim.note.noOrder', { mentioned: m[0].toUpperCase() }));
      var hits = Object.keys(KW).filter(function (k) { return KW[k].some(function (w) { return text.toLowerCase().indexOf(w) !== -1; }); });
      var warn = '';
      if (!flags.length) {
        if (hits.length > 1) warn = T('sim.hint.twoIntents');
        else if (!hits.length) warn = T('sim.hint.unclear');
        else if (!order) warn = T('sim.hint.noOrder');
      }
      setHint(warn, true);
      start({
        id: 'custom',
        input: { text: text, customer: { customer_id: order ? order.customer_id : 'SYN-CUST-GUEST', flags: flags }, order: order, today: TODAY },
        notes: notes
      });
    });

    /* --- run --- */
    function resetChips() {
      Object.keys(chips).forEach(function (k) { chips[k].li.classList.remove('is-lit'); chips[k].sr.textContent = T('sim.chip.off'); });
    }
    function light(k) { if (chips[k] && !chips[k].li.classList.contains('is-lit')) { chips[k].li.classList.add('is-lit'); chips[k].sr.textContent = T('sim.chip.on'); } }

    function start(job) {
      token += 1;
      var my = token;
      var res = window.SynqEngine.evaluateReturn(job.input);
      current = { id: job.id, input: job.input, result: res, audit: res.audit.map(function (a) { return { seq: a.seq, state: a.state, detail: a.detail }; }), decided: null };
      lines.textContent = '';
      lines.classList.remove('has-stop');
      idle.hidden = true;
      resetChips();
      clearOutcome();
      renderAudit();
      dl.disabled = true;
      var rows = [];
      job.notes.forEach(function (n) { rows.push({ note: n }); });
      res.steps.forEach(function (s) { rows.push({ step: s }); });
      var i = 0, n = 0;
      run = { skip: false };
      runBtn.disabled = true; runBtn.textContent = T('sim.running');
      skip.hidden = false;
      function next() {
        if (my !== token) return;
        if (i >= rows.length) return finish(my);
        printRow(rows[i], rows[i].step ? n++ : null);
        i += 1;
        if (run.skip || reduced()) next(); else setTimeout(next, TICK);
      }
      next();
    }
    skip.addEventListener('click', function () { if (run) run.skip = true; });

    function printRow(r, n) {
      var li = h('li', 'sim-line', lines);
      if (r.note) {
        li.classList.add('is-note');
        h('span', 'sim-n num', li, '•');
        h('span', 'sim-k', li, T('sim.noteKey'));
        h('span', 'sim-d', li, r.note);
        return;
      }
      var s = r.step;
      var stopped = lines.classList.contains('has-stop');
      li.setAttribute('data-status', s.status);
      if (stopped) li.classList.add('is-after-stop');
      h('span', 'sim-n num', li, pad2(n));
      h('span', 'sim-k', li, STEP_KEY[s.id] ? TK(['sim.step.', s.id]) : s.id.toUpperCase());
      var d = h('span', 'sim-d', li, trEngine(s.detail || s.label));
      d.setAttribute('dir', 'auto');
      var g = s.status === 'blocked' ? T('sim.g.stop') : s.status === 'routed' ? T('sim.g.human') : s.status !== 'done' ? T('sim.g.notReached')
        : s.id === 'execute' ? T('sim.g.ai') : s.id === 'audit' ? T('sim.g.sealed') : T('sim.g.pass');
      h('span', 'sim-g', li, g);
      [].forEach.call(lines.querySelectorAll('.is-current'), function (x) { x.classList.remove('is-current'); });
      li.classList.add('is-current');
      if (s.status === 'blocked') lines.classList.add('has-stop');
      if ((s.id === 'policy' && (s.status === 'done' || s.status === 'blocked')) || s.status === 'blocked') light('policy');
      if ((s.id === 'permission' && s.status !== 'pending' && s.status !== 'skipped') || (s.id === 'execute' && s.status !== 'pending')) light('money');
      if (s.id === 'audit' && s.status === 'done') light('log');
    }

    function finish(my) {
      if (my !== token) return;
      run = null;
      skip.hidden = true;
      runBtn.textContent = T('sim.run');
      updateCount();
      [].forEach.call(lines.querySelectorAll('.is-current'), function (x) { x.classList.remove('is-current'); });
      renderOutcome();
      renderAudit();
      dl.disabled = false;
    }

    function clearOutcome() { out.textContent = ''; out.appendChild(outIdle); out.removeAttribute('data-d'); }

    function chip(cls, glyph, text) {
      var c = h('p', 'chip sim-status ' + cls, null);
      // the glyph itself comes from base.css (.chip--ok/--warn/--stop::before)
      c.setAttribute('data-glyph', glyph);
      h('span', null, c, text);
      return c;
    }

    function renderOutcome() {
      var r = current.result, o = current.input.order;
      out.textContent = '';
      out.setAttribute('data-d', r.decision);
      var E = window.SynqEngine;
      if (r.decision === 'auto') {
        out.appendChild(chip('chip--ok sim-status--ok', '✓', T('sim.out.verified')));
        h('p', 'sim-lane is-ai', out, T('sim.lane.ai'));
        h('p', 'sim-out-t', out, trEngine(r.outcome));
      } else if (r.decision === 'human_approve') {
        var decided = current.decided;
        if (!decided) out.appendChild(chip('chip--warn sim-status--warn', '◐', T('sim.out.waiting')));
        else if (decided === 'approve') out.appendChild(chip('chip--ok sim-status--ok', '✓', T('sim.out.approved')));
        else out.appendChild(chip('chip--stop sim-status--stop', '✕', T('sim.out.rejected')));
        var senior = r.reason === 'senior-refund-approval';
        h('p', 'sim-lane', out, senior ? T('sim.lane.seniorHuman') : T('sim.lane.human'));
        var card = h('div', 'sim-assist', out);
        h('p', 'sim-assist-k', card, T('sim.assist.k'));
        var days = o ? dayDiff(current.input.today, o.delivered_on) : 0;
        var isRefund = r.intent === 'refund';
        h('p', 'sim-assist-t', card, T('sim.assist.proposed', {
          intent: word('sim.intent.', r.intent), order: o ? o.order_id : T('sim.assist.orderWord'), days: days,
          amount: o ? intInt(o.amount) + ' ' + o.currency : '', reason: reasonText(E, r.reason) }));
        if (isRefund) h('p', 'sim-note', card, senior ? T('sim.assist.moneySenior') : T('sim.assist.moneyHuman'));
        if (!decided) {
          var row = h('div', 'sim-assist-actions', card);
          var ap = h('button', 'btn btn-primary btn-sm', row, isRefund ? T('sim.btn.approveRefund') : T('sim.btn.approveIntent', { intent: word('sim.intent.', r.intent) })); ap.type = 'button';
          var rj = h('button', 'btn btn-secondary btn-sm', row, T('sim.btn.reject')); rj.type = 'button';
          ap.addEventListener('click', function () { decide('approve'); });
          rj.addEventListener('click', function () { decide('reject'); });
        } else {
          h('p', 'sim-out-t', card, decided === 'approve'
            ? (isRefund ? T('sim.res.refundApproved') : T('sim.res.approved', { intent: word('sim.intent.', r.intent) }))
            : T('sim.res.rejected'));
        }
      } else {
        var info = r.decision === 'needs_info';
        out.appendChild(chip('chip--stop sim-status--stop', '✕', info ? T('sim.out.needsInfo') : T('sim.out.escalated')));
        h('p', 'sim-lane', out, T('sim.lane.human'));
        h('p', 'sim-out-t', out, E.REASON_TEXT[r.reason] ? reasonText(E, r.reason) : trEngine(r.outcome));
        if (r.reason === 'fraud-signal') h('p', 'sim-note', out, T('sim.note.fraud'));
        if (r.reason === 'missing-order') h('p', 'sim-note', out, T('sim.hint.noOrder'));
      }
    }

    function decide(kind) {
      if (!current || current.decided) return;
      current.decided = kind;
      var r = current.result;
      var push = function (state, detail) { current.audit.push({ seq: current.audit.length + 1, state: state, detail: detail }); };
      push('HUMAN_DECISION', kind + ' (simulated reviewer)');
      if (kind === 'approve') {
        if (r.intent === 'refund') push('REFUND_APPROVED_SIMULATED', 'Approval recorded; no money moves in this demo');
        else {
          push('RETURN_CREATED', 'Synthetic ' + r.intent + ' record created after human approval');
          push('PICKUP_SCHEDULED', 'Synthetic pickup record scheduled');
          push('OUTCOME_VERIFIED', 'Both synthetic records present; approved by human');
        }
      } else push('CASE_CLOSED', 'Rejected by human; no external action');
      push('AUDIT_WRITTEN', 'Trail sealed');
      renderOutcome();
      renderAudit();
      var f = out.querySelector('.sim-status'); if (f) { f.setAttribute('tabindex', '-1'); f.focus(); }
    }

    function renderAudit() {
      auditList.textContent = '';
      if (!current) { auditSum.textContent = T('sim.audit.title'); return; }
      current.audit.forEach(function (a) {
        var li = h('li', null, auditList);
        h('span', 'sim-a-seq', li, pad2(a.seq));
        h('span', 'sim-a-state', li, a.state);
        var d = h('span', 'sim-a-detail', li, trEngine(a.detail)); d.setAttribute('dir', 'auto');
      });
      auditSum.textContent = T('sim.audit.count', { n: current.audit.length });
    }

    dl.addEventListener('click', function () {
      if (!current) return;
      var r = current.result;
      var payload = {
        simulated: true,
        notice: STAMP,
        scenario: current.id,
        generated_for_date: TODAY,
        input: { text: current.input.text, customer: current.input.customer, order: current.input.order },
        decision: r.decision, reason: r.reason, outcome: r.outcome, human_decision: current.decided,
        steps: r.steps.map(function (s) { return { id: s.id, status: s.status, detail: s.detail }; }),
        audit: current.audit.map(function (a) {
          return { seq: a.seq, ts: simTs(a.seq), state: a.state, detail: a.detail, rule_ref: a.state === 'POLICY_DECISION' ? (RULE_REF[a.detail] || null) : null };
        })
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'synq-sim-audit-' + current.id + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    });

    updateCount();
  }
}());
