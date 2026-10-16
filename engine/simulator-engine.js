/*!
 * SYNQ return-decision simulator engine (browser + Node, dependency-free, UMD)
 *
 * SYNTHETIC OFFLINE DEMO. All data, orders, customers and policy values are
 * invented. Thresholds (14-day window, 500 auto cap, 1000 senior refund) are
 * ILLUSTRATIVE only and must be replaced by a client's signed policy.
 * Deterministic: no network, no LLM, no randomness. Mirrors the Python
 * reference in projects/synq/demo/simulator (engine.py, classifier.py).
 *
 * Pipeline: intent -> context -> policy rules -> permission check ->
 *           AI executes OR routes to client human -> outcome verified -> audit
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynqEngine = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var POLICY = {
    return_window_days_inclusive: 14,
    auto_action_max_local_currency_inclusive: 500,
    senior_refund_above_local_currency: 1000,
    returnable_categories: ['apparel', 'home'],
    allowed_item_condition: 'unopened',
    currencies: ['SAR', 'AED']
  };

  var KEYWORDS = [
    ['return', ['return', 'إرجاع']],
    ['exchange', ['exchange', 'استبدال']],
    ['refund', ['refund', 'استرداد']]
  ];

  function classifyIntent(text) {
    var t = String(text == null ? '' : text).toLowerCase();
    var hits = [];
    KEYWORDS.forEach(function (k) {
      if (k[1].some(function (w) { return t.indexOf(w) !== -1; })) hits.push(k[0]);
    });
    return hits.length === 1 ? hits[0] : 'unknown';
  }

  var STEP_DEFS = [
    ['intent', 'Understand request'],
    ['context', 'Gather order context'],
    ['policy', 'Check policy rules'],
    ['permission', 'Check permissions'],
    ['execute', 'Execute or route to client human'],
    ['verify', 'Verify outcome'],
    ['audit', 'Write audit trail']
  ];

  function parseDay(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return NaN;
    var p = s.split('-').map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    if (d.getUTCFullYear() !== p[0] || d.getUTCMonth() !== p[1] - 1 || d.getUTCDate() !== p[2]) return NaN;
    return Math.floor(d.getTime() / 86400000);
  }

  var REASON_TEXT = {
    'eligible-auto': 'Within window, eligible item, amount at or under the auto limit.',
    'approval-threshold': 'Amount is above the auto-action limit; client human must approve.',
    'refund-approval': 'Refunds always need client human approval.',
    'senior-refund-approval': 'Refund above the senior threshold; senior client approval required.',
    'outside-window': 'Delivered more than 14 days ago.',
    'excluded-category': 'Category is not returnable under policy.',
    'used-item': 'Item is not unopened.',
    'missing-order': 'No order could be matched; more information needed.',
    'missing-date': 'Request or delivery date is missing; more information needed.',
    'vip-complaint': 'VIP complaint; routed to a client human.',
    'fraud-signal': 'Fraud signal; routed to a client human, no action taken.',
    'ambiguous-request': 'Intent is unclear; routed to a client human.',
    'invalid-order-facts': 'Order facts are inconsistent; routed to a client human.',
    'order-customer-mismatch': 'Order does not belong to this customer; routed to a client human.'
  };

  function evaluateReturn(input) {
    input = input || {};
    var order = input.order || null;
    var customer = input.customer || {};
    var text = input.text;
    var today = input.today || null;
    var flags = (customer.flags || input.flags || []).slice();

    var steps = STEP_DEFS.map(function (d) {
      return { id: d[0], label: d[1], detail: '', status: 'pending' };
    });
    var byId = {};
    steps.forEach(function (s) { byId[s.id] = s; });
    var audit = [];
    function log(state, detail) { audit.push({ seq: audit.length + 1, state: state, detail: detail }); }
    function set(id, status, detail) { byId[id].status = status; byId[id].detail = detail; }

    var intent = classifyIntent(text);
    log('RETURN_REQUESTED', 'Synthetic request received');
    log('INTENT_CLASSIFIED', intent);
    set('intent', 'done', 'Classified as "' + intent + '" by deterministic keyword rules (EN + AR).');

    var result = { decision: null, reason: null, outcome: null };

    function finish(decision, reason, outcome, blockedAt) {
      result.decision = decision; result.reason = reason; result.outcome = outcome;
      var seen = false;
      steps.forEach(function (s) {
        if (s.id === blockedAt) { seen = true; return; }
        if (seen && s.status === 'pending' && s.id !== 'audit') {
          s.status = 'skipped'; s.detail = 'Not reached.';
        }
      });
      if (decision === 'auto') {
        // all steps already done
      } else {
        set('execute', decision === 'human_approve' || decision === 'escalate' ? 'routed' : 'blocked',
          decision === 'needs_info' ? 'No action taken; asked for missing information.' :
          'No external action; routed to client human (' + decision + ').');
        set('verify', 'skipped', 'No action executed, nothing to verify.');
      }
      log('POLICY_DECISION', reason);
      if (decision !== 'auto') log(decision === 'human_approve' ? 'WAITING_HUMAN_APPROVAL' :
        decision === 'needs_info' ? 'WAITING_CUSTOMER_INFO' : 'ESCALATED', 'No external action; routed to client human');
      set('audit', 'done', audit.length + ' events recorded (append-only).');
      log('AUDIT_WRITTEN', 'Trail sealed');
      return { intent: intent, steps: steps, decision: decision, reason: reason, outcome: outcome, audit: audit };
    }

    function stopAt(stepId, status, detail, decision, reason, outcome) {
      set(stepId, status, detail);
      return finish(decision, reason, outcome, stepId);
    }

    // Risk flags and unknown intent are checked before any lookup (as in Python).
    if (flags.indexOf('fraud_signal') !== -1) {
      set('context', 'done', 'Risk flag present on case.');
      return stopAt('policy', 'blocked', 'Fraud signal overrides all other rules.', 'escalate', 'fraud-signal',
        'Escalated to client fraud team. No action taken.');
    }
    if (flags.indexOf('vip_complaint') !== -1) {
      set('context', 'done', 'VIP complaint flag present.');
      return stopAt('policy', 'blocked', 'VIP complaints are never handled automatically.', 'escalate', 'vip-complaint',
        'Escalated to client account owner. No action taken.');
    }
    if (intent === 'unknown') {
      return stopAt('context', 'blocked', 'Cannot pick a workflow without a clear intent.', 'escalate', 'ambiguous-request',
        'Routed to client human for clarification. No action taken.');
    }
    if (!order) {
      return stopAt('context', 'blocked', 'No matching order found.', 'needs_info', 'missing-order',
        'Asked customer for the order number. No action taken.');
    }
    if (order.customer_id !== customer.customer_id) {
      return stopAt('context', 'blocked', 'Order belongs to a different customer.', 'escalate', 'order-customer-mismatch',
        'Escalated to client human. No action taken.');
    }
    if (!today || !order.delivered_on) {
      return stopAt('context', 'blocked', 'Request date or delivery date is absent.', 'needs_info', 'missing-date',
        'Asked for the missing date. No action taken.');
    }
    var elapsed = parseDay(today) - parseDay(order.delivered_on);
    var amount = /^-?\d+$/.test(String(order.amount)) ? parseInt(order.amount, 10) : NaN;
    if (isNaN(elapsed) || isNaN(amount) || elapsed < 0 || amount < 0 ||
        order.status !== 'delivered' || POLICY.currencies.indexOf(order.currency) === -1) {
      return stopAt('context', 'blocked', 'Order facts are invalid or inconsistent.', 'escalate', 'invalid-order-facts',
        'Escalated to client human. No action taken.');
    }
    log('ORDER_IDENTIFIED', order.order_id);
    log('ELIGIBILITY_CHECK', elapsed + ' days after delivery; ' + amount + ' ' + order.currency);
    set('context', 'done', 'Order ' + order.order_id + ': ' + amount + ' ' + order.currency + ', ' +
      order.category + ', ' + order.item_condition + ', delivered ' + elapsed + ' day(s) ago.');

    if (elapsed > POLICY.return_window_days_inclusive)
      return stopAt('policy', 'blocked', elapsed + ' days > ' + POLICY.return_window_days_inclusive + '-day window.',
        'escalate', 'outside-window', 'Escalated to client human. No action taken.');
    if (POLICY.returnable_categories.indexOf(order.category) === -1)
      return stopAt('policy', 'blocked', 'Category "' + order.category + '" is excluded.',
        'escalate', 'excluded-category', 'Escalated to client human. No action taken.');
    if (order.item_condition !== POLICY.allowed_item_condition)
      return stopAt('policy', 'blocked', 'Item condition "' + order.item_condition + '" is not unopened.',
        'escalate', 'used-item', 'Escalated to client human. No action taken.');
    set('policy', 'done', 'Window, category and condition rules all pass.');

    if (intent === 'refund') {
      var senior = amount > POLICY.senior_refund_above_local_currency;
      return stopAt('permission', 'blocked',
        senior ? 'Refund above ' + POLICY.senior_refund_above_local_currency + ': AI may not act; senior approval needed.' :
                 'Refunds are never AI-executable; client human approval needed.',
        'human_approve', senior ? 'senior-refund-approval' : 'refund-approval',
        'Approval request sent to client' + (senior ? ' senior' : '') + ' human. No refund issued.');
    }
    if (amount > POLICY.auto_action_max_local_currency_inclusive)
      return stopAt('permission', 'blocked',
        amount + ' exceeds the ' + POLICY.auto_action_max_local_currency_inclusive + ' auto limit.',
        'human_approve', 'approval-threshold', 'Approval request sent to client human. No action taken.');

    set('permission', 'done', 'AI is permitted to initiate ' + intent + ' at ' + amount + ' ' + order.currency + '.');
    log('POLICY_DECISION', 'eligible-auto');
    log('AUTO_ALLOWED', 'Policy and permissions allow fictional initiation');
    log('ACTION', 'Offline ' + intent + ' initiation only');
    log('RETURN_CREATED', 'Synthetic return/exchange record created');
    log('PICKUP_SCHEDULED', 'Synthetic pickup record scheduled');
    set('execute', 'done', 'AI created the ' + intent + ' record and scheduled a pickup (synthetic).');
    log('OUTCOME_VERIFIED', 'Both synthetic records present; policy and route valid');
    set('verify', 'done', 'Return record and pickup both confirmed present.');
    set('audit', 'done', (audit.length + 1) + ' events recorded (append-only).');
    log('AUDIT_WRITTEN', 'Trail sealed');
    return {
      intent: intent, steps: steps, decision: 'auto', reason: 'eligible-auto',
      outcome: 'Verified: synthetic ' + intent + ' created and pickup scheduled by AI.', audit: audit
    };
  }

  return { POLICY: POLICY, REASON_TEXT: REASON_TEXT, classifyIntent: classifyIntent, evaluateReturn: evaluateReturn };
}));
