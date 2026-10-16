/*!
 * SYNQ demo preset scenarios. SYNTHETIC OFFLINE DEMO data; all names, IDs and
 * amounts are invented. Thresholds are illustrative. Plain data, UMD.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynqScenarios = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return [
    {
      id: 'auto-return', title: 'Routine return (auto)', risky: false,
      text: 'I want to return order SYN-ORDER-0101.',
      customer: { customer_id: 'SYN-CUST-0101', flags: [] },
      order: { order_id: 'SYN-ORDER-0101', customer_id: 'SYN-CUST-0101', market: 'SA', currency: 'SAR',
        amount: '120', delivered_on: '2026-10-08', category: 'apparel', item_condition: 'unopened', status: 'delivered' },
      today: '2026-10-14'
    },
    {
      id: 'arabic-exchange', title: 'Arabic exchange (auto)', risky: false,
      text: 'أريد استبدال الطلب SYN-ORDER-0102.',
      customer: { customer_id: 'SYN-CUST-0102', flags: [] },
      order: { order_id: 'SYN-ORDER-0102', customer_id: 'SYN-CUST-0102', market: 'AE', currency: 'AED',
        amount: '260', delivered_on: '2026-10-10', category: 'home', item_condition: 'unopened', status: 'delivered' },
      today: '2026-10-14'
    },
    {
      id: 'high-value-refund', title: 'High-value refund (human approval)', risky: true,
      text: 'I want a refund for order SYN-ORDER-0103.',
      customer: { customer_id: 'SYN-CUST-0103', flags: [] },
      order: { order_id: 'SYN-ORDER-0103', customer_id: 'SYN-CUST-0103', market: 'AE', currency: 'AED',
        amount: '1850', delivered_on: '2026-10-09', category: 'apparel', item_condition: 'unopened', status: 'delivered' },
      today: '2026-10-14'
    },
    {
      id: 'fraud-signal', title: 'Fraud signal (escalate)', risky: true,
      text: 'I want to return order SYN-ORDER-0104.',
      customer: { customer_id: 'SYN-CUST-0104', flags: ['fraud_signal'] },
      order: { order_id: 'SYN-ORDER-0104', customer_id: 'SYN-CUST-0104', market: 'SA', currency: 'SAR',
        amount: '640', delivered_on: '2026-10-11', category: 'apparel', item_condition: 'unopened', status: 'delivered' },
      today: '2026-10-14'
    }
  ];
}));
