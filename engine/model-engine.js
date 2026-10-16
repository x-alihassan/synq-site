/* SYNQ illustrative savings/staffing model engine. Dependency-free, UMD.
 * ILLUSTRATIVE ONLY: outputs are arithmetic on the visitor's own inputs.
 * Deliberately outputs time, cost and FTE only. No satisfaction/CSAT figures. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynqModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Every constant used by the model lives here.
  var DEFAULTS = {
    monthlyVolume: 10000,      // work items per month
    ahtMin: 8,                 // average handling time per item, minutes
    humanCostPerHour: 12,      // fully loaded paid cost per FTE hour, USD
    shrinkage: 0.3,            // share of paid time not available (leave, breaks, training)
    occupancyTarget: 0.85,     // share of available time spent on work
    shareAutomated: 0.4,       // share of items the AI resolves end to end
    aiCostPerOutcome: 0.03,    // USD per AI-handled outcome (cf. demo config auto_verified_action)
    humanReviewShare: 0.1,     // share of AI outcomes a human reviews
    hoursPerFte: 160,          // paid hours per FTE per month
    reviewTimeFactor: 0.25,    // a review takes this fraction of full AHT (assumption)
    humanAcceptanceRate: 1,    // share of human outcomes accepted (assumption: all)
    aiAcceptanceRate: 1,       // share of AI outcomes accepted (assumption: all)
    targetSLA: 0.8,            // service level target for intraday staffing
    answerSec: 20,             // SLA answer threshold, seconds
    intervalSec: 1800,         // interval length, seconds (30 min)
    maxAgents: 5000            // search cap for requiredAgents
  };

  // ILLUSTRATIVE typical 48 half-hour interval shape (share of daily volume, sums to 1).
  // Not measured data; a generic office-hours contact curve.
  var ILLUSTRATIVE_SHAPE_48 = (function () {
    var raw = [
      0.2, 0.2, 0.1, 0.1, 0.1, 0.1, 0.2, 0.3, 0.6, 1.0, 1.6, 2.4,
      3.4, 4.4, 5.2, 5.8, 6.0, 5.8, 5.4, 5.6, 5.8, 5.6, 5.2, 4.8,
      4.4, 4.0, 3.6, 3.2, 2.8, 2.4, 2.0, 1.7, 1.4, 1.2, 1.0, 0.9,
      0.8, 0.7, 0.6, 0.5, 0.4, 0.4, 0.3, 0.3, 0.3, 0.2, 0.2, 0.2
    ];
    var s = raw.reduce(function (a, b) { return a + b; }, 0);
    return raw.map(function (x) { return x / s; });
  })();

  function num(v, name) {
    if (typeof v !== 'number' || !isFinite(v)) throw new Error('Invalid number for ' + name);
    return v;
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  // Erlang C: probability a call waits. traffic in Erlangs, agents integer.
  // Uses the Erlang B recursion (numerically stable for large agent counts).
  function erlangC(traffic, agents) {
    num(traffic, 'traffic'); num(agents, 'agents');
    if (traffic < 0 || agents < 0) throw new Error('traffic/agents must be >= 0');
    if (traffic === 0) return 0;
    var n = Math.floor(agents);
    if (n <= traffic) return 1;
    var b = 1;
    for (var k = 1; k <= n; k++) b = (traffic * b) / (k + traffic * b);
    return b / (1 - (traffic / n) * (1 - b));
  }

  function serviceLevel(traffic, agents, ahtSec, answerSec) {
    if (traffic === 0) return 1;
    if (agents <= traffic) return 0;
    return 1 - erlangC(traffic, agents) * Math.exp(-(agents - traffic) * answerSec / ahtSec);
  }

  // Minimum agents so that service level >= targetSLA within answerSec.
  function requiredAgents(volumePerInterval, ahtSec, intervalSec, targetSLA, answerSec) {
    var d = DEFAULTS;
    intervalSec = intervalSec === undefined ? d.intervalSec : intervalSec;
    targetSLA = targetSLA === undefined ? d.targetSLA : targetSLA;
    answerSec = answerSec === undefined ? d.answerSec : answerSec;
    num(volumePerInterval, 'volumePerInterval'); num(ahtSec, 'ahtSec');
    num(intervalSec, 'intervalSec'); num(targetSLA, 'targetSLA'); num(answerSec, 'answerSec');
    if (volumePerInterval < 0 || ahtSec <= 0 || intervalSec <= 0 || answerSec < 0) throw new Error('Invalid staffing inputs');
    targetSLA = clamp(targetSLA, 0, 0.999);
    var traffic = volumePerInterval * ahtSec / intervalSec;
    if (traffic === 0) return 0;
    var n = Math.floor(traffic) + 1;
    while (n < d.maxAgents && serviceLevel(traffic, n, ahtSec, answerSec) < targetSLA) n++;
    return n;
  }

  // Paid heads needed to cover `required` on-seat agents given shrinkage.
  function scheduledFromRequired(required, shrinkage) {
    num(required, 'required'); num(shrinkage, 'shrinkage');
    if (required < 0) throw new Error('required must be >= 0');
    shrinkage = clamp(shrinkage, 0, 0.9);
    return required / (1 - shrinkage);
  }

  // Splits monthly volume to an average day, then across the shape.
  function intradayProfile(monthlyVolume, shapeArray, daysPerMonth) {
    num(monthlyVolume, 'monthlyVolume');
    if (monthlyVolume < 0) throw new Error('monthlyVolume must be >= 0');
    var shape = shapeArray || ILLUSTRATIVE_SHAPE_48;
    if (!Array.isArray(shape) || !shape.length) throw new Error('shapeArray must be a non-empty array');
    var sum = 0;
    shape.forEach(function (x) { num(x, 'shape'); if (x < 0) throw new Error('shape must be >= 0'); sum += x; });
    if (sum <= 0) throw new Error('shape sums to zero');
    var days = daysPerMonth === undefined ? 30 : num(daysPerMonth, 'daysPerMonth');
    if (days <= 0) throw new Error('daysPerMonth must be > 0');
    var daily = monthlyVolume / days;
    return shape.map(function (x) { return daily * x / sum; });
  }

  function validate(input) {
    var i = input || {}, d = DEFAULTS, out = {}, notes = [];
    function get(name, lo, hi) {
      var v = i[name] === undefined || i[name] === null ? d[name] : i[name];
      if (typeof v !== 'number' || !isFinite(v)) throw new Error('Invalid input: ' + name);
      var c = clamp(v, lo, hi);
      if (c !== v) notes.push(name + ' was adjusted from ' + v + ' to ' + c + ' to stay in the supported range.');
      out[name] = c;
    }
    get('monthlyVolume', 0, 1e8);
    get('ahtMin', 0.1, 600);
    get('humanCostPerHour', 0, 10000);
    get('shrinkage', 0, 0.9);
    get('occupancyTarget', 0.3, 0.95);
    get('shareAutomated', 0, 1);
    get('aiCostPerOutcome', 0, 1000);
    get('humanReviewShare', 0, 1);
    get('hoursPerFte', 20, 744);
    get('reviewTimeFactor', 0, 1);
    get('humanAcceptanceRate', 0.01, 1);
    get('aiAcceptanceRate', 0.01, 1);
    return { v: out, notes: notes };
  }

  function round(x, p) { var f = Math.pow(10, p === undefined ? 2 : p); return Math.round(x * f) / f; }

  function scenario(inputs) {
    var r = validate(inputs), v = r.v;
    var productivePerFte = v.hoursPerFte * (1 - v.shrinkage) * v.occupancyTarget;
    var costPerPaidHour = v.humanCostPerHour;

    function side(humanHours, aiOutcomes, humanItems, acceptedOutcomes) {
      var fte = humanHours / productivePerFte;
      var humanCost = fte * v.hoursPerFte * costPerPaidHour;
      var aiCost = aiOutcomes * v.aiCostPerOutcome;
      var cost = humanCost + aiCost;
      return {
        fteRequired: fte,
        humanCost: humanCost,
        aiCost: aiCost,
        monthlyCost: cost,
        acceptedOutcomes: acceptedOutcomes,
        costPerAcceptedOutcome: acceptedOutcomes > 0 ? cost / acceptedOutcomes : 0,
        humanWorkHours: humanHours,
        humanItems: humanItems
      };
    }

    var V = v.monthlyVolume;
    var oldHours = V * v.ahtMin / 60;
    var oldSide = side(oldHours, 0, V, V * v.humanAcceptanceRate);

    var autoItems = V * v.shareAutomated;
    var residualItems = V - autoItems;
    var reviewed = autoItems * v.humanReviewShare;
    var newHours = (residualItems * v.ahtMin + reviewed * v.ahtMin * v.reviewTimeFactor) / 60;
    var newAccepted = residualItems * v.humanAcceptanceRate + autoItems * v.aiAcceptanceRate;
    var newSide = side(newHours, autoItems, residualItems + reviewed, newAccepted);

    var hoursFreed = Math.max(0, oldHours - newHours);
    var res = {
      inputs: v,
      old: oldSide,
      new: newSide,
      hoursFreed: hoursFreed,
      fteFreed: oldSide.fteRequired - newSide.fteRequired,
      monthlySavings: oldSide.monthlyCost - newSide.monthlyCost,
      residualHumanWork: {
        hours: newHours,
        items: residualItems,
        reviewedItems: reviewed
      },
      assumptions: []
    };
    var a = res.assumptions;
    a.push('Illustrative only: every figure is arithmetic on the numbers you entered, not a forecast or a guarantee.');
    a.push('One FTE is ' + v.hoursPerFte + ' paid hours a month, of which ' + round(v.shrinkage * 100, 0) + '% is unavailable (shrinkage) and staff are busy ' + round(v.occupancyTarget * 100, 0) + '% of the remaining time.');
    a.push('Human cost is ' + v.humanCostPerHour + ' per paid hour; AI cost is ' + v.aiCostPerOutcome + ' per automated outcome.');
    a.push(round(v.shareAutomated * 100, 0) + '% of items are assumed fully handled by AI; the rest stay with people.');
    a.push(round(v.humanReviewShare * 100, 0) + '% of AI outcomes are assumed to get a human review, each taking ' + round(v.reviewTimeFactor * 100, 0) + '% of a normal handling time.');
    a.push('Acceptance rates are assumed at ' + round(v.humanAcceptanceRate * 100, 0) + '% (human) and ' + round(v.aiAcceptanceRate * 100, 0) + '% (AI). Cost per accepted outcome is total cost divided by accepted outcomes.');
    a.push('Staffing uses average workload, not an interval-level schedule; it excludes setup, integration, hosting and management costs.');
    a.push('No quality or satisfaction effects are modelled. Only time, cost and FTE are shown.');
    r.notes.forEach(function (n) { a.push(n); });
    return res;
  }

  return {
    DEFAULTS: DEFAULTS,
    ILLUSTRATIVE_SHAPE_48: ILLUSTRATIVE_SHAPE_48,
    erlangC: erlangC,
    serviceLevel: serviceLevel,
    requiredAgents: requiredAgents,
    scheduledFromRequired: scheduledFromRequired,
    intradayProfile: intradayProfile,
    scenario: scenario
  };
});
