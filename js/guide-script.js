/* SYNQ website v3 - script for "Sy", the flying tour guide (read by js/guide.js).
   THE LINES ARE KEYS (guide.<section>.<step>.<n>) into js/i18n-en.js and js/i18n-ar.js: edit the words there, in BOTH files,
   then run `node qa/i18n-check.cjs`. This file only decides which keys play where. No build step: save and reload.

   SCHEMA
   window.SYNQ_GUIDE_SCRIPT = {
     name:  'Sy'                       shown on the speech bubble
     vars:  { key: source }            numbers the lines may use as {key}. NEVER type a number into a line:
                                       every number must come from the page or the engine at runtime.
            source = { sel: 'css selector', i: 0 }   text of the i-th match on the page (what the visitor sees)
            source = { calc: 'hoursFreed' }          the calculator output with data-o="hoursFreed" (engine-computed)
            If a var cannot be read, the whole line that uses it is dropped (the guide never guesses).
     beats: [ {
       section: 'old-way'              section id on index.html (hero, old-way, shift, new-way, proof,
                                       simulator, calculator, vision, faq, cta)
       step:    2                      optional: plays when that chapter step is active (tour.js data-active-step)
       anchor:  'css selector'         what Sy flies next to (falls back to the section)
       pose:    'point' | 'wave' | 'think' | 'thumbs' | 'draw' | 'idle'
       lines:   ['1-3 i18n keys']      typed into the bubble one after another (their {vars} are filled from the page)
       draw:    [ { kind: 'circle' | 'underline' | 'arrow' | 'tick', target: 'css selector', all: true } ]
                                       hand-drawn marks on the real chart (all: mark every match)
       when:    'css selector'         optional: wait until this exists before drawing (e.g. the surge peak is shown)
       pop:     { from: 'key', to: 'key', label: 'i18n key' }   optional count-up card (values are vars)
       action:  'demoSlider' | 'flourish'                    optional built-in behaviour
     } ]
   }
   Content rules (data-spec): illustrative model wording where the page uses it; no new claims,
   no customers, testimonials, prices, employer/client names or CSAT lifts. Keep lines consistent
   with the chapter copy. */
window.SYNQ_GUIDE_SCRIPT = {
  name: 'Sy',
  vars: {
    contacts:   { sel: '#old-way .step[data-step="0"] .num', i: 0 },
    idle:       { sel: '#old-way .step[data-step="1"] .num', i: 0 },
    sched04:    { sel: '#old-way .step[data-step="1"] .num', i: 1 },
    need04:     { sel: '#old-way .step[data-step="1"] .num', i: 2 },
    surge:      { sel: '#old-way .step[data-step="2"] .num', i: 0 },
    slWorst:    { sel: '#old-way .step[data-step="2"] .num', i: 1 },
    breachOld:  { sel: '#old-way .step[data-step="2"] .num', i: 2 },
    paidOld:    { sel: '#old-way .step[data-step="3"] .num', i: 0 },
    shifts:     { sel: '#old-way .step[data-step="3"] .num', i: 1 },
    cpoOld:     { sel: '#old-way .step[data-step="3"] .num', i: 2 },
    rate:       { sel: '#old-way .step[data-step="3"] .num', i: 3 },
    eligible:   { sel: '#shift .step[data-step="1"] .num', i: 0 },
    aiOutcomes: { sel: '#new-way .step[data-step="1"] .num', i: 0 },
    breachA:    { sel: '#new-way .step[data-step="2"] .num', i: 0 },
    breachB:    { sel: '#new-way .step[data-step="2"] .num', i: 1 },
    worstNew:   { sel: '#new-way .step[data-step="2"] .num', i: 3 },
    volLeaves:  { sel: '#new-way .step[data-step="3"] .num', i: 0 },
    paidCut:    { sel: '#new-way .step[data-step="3"] .num', i: 1 },
    paidNew:    { sel: '#new-way .step[data-step="3"] .num', i: 3 },
    cpoNew:     { sel: '#new-way .step[data-step="3"] .num', i: 5 },
    hoursFreed: { calc: 'hoursFreed' }
  },
  beats: [
    { section: 'hero', anchor: '#hero h1', pose: 'wave',
      lines: ['guide.hero.0', 'guide.hero.1'] },

    { section: 'old-way', step: 0, anchor: '#stage-old .layer-bars', pose: 'point',
      lines: ['guide.old-way.0.0', 'guide.old-way.0.1'],
      draw: [{ kind: 'underline', target: '#stage-old .layer-bars' }] },
    { section: 'old-way', step: 1, anchor: '#stage-old .sc-gap', pose: 'draw',
      lines: ['guide.old-way.1.0', 'guide.old-way.1.1'],
      draw: [{ kind: 'arrow', target: '#stage-old .sc-gap' }] },
    { section: 'old-way', step: 2, anchor: '#stage-old .sc-peak', pose: 'draw', when: '#stage-old .layer-peak.is-on',
      lines: ['guide.old-way.2.0', 'guide.old-way.2.1'],
      draw: [{ kind: 'circle', target: '#stage-old .sc-peak' }] },
    { section: 'old-way', step: 3, anchor: '#stage-old .stage-ledger', pose: 'think',
      lines: ['guide.old-way.3.0', 'guide.old-way.3.1'],
      draw: [{ kind: 'underline', target: '#stage-old .ledger-rows > div:last-child dd' }] },

    { section: 'shift', step: 0, anchor: '#stage-shift .stage-figure', pose: 'think',
      lines: ['guide.shift.0.0'] },
    { section: 'shift', step: 1, anchor: '#stage-shift .stage-legend li', pose: 'point',
      lines: ['guide.shift.1.0', 'guide.shift.1.1'],
      draw: [{ kind: 'circle', target: '#stage-shift .stage-legend li' }] },

    { section: 'new-way', step: 0, anchor: '#stage-new .route-svg', pose: 'draw',
      lines: ['guide.new-way.0.0', 'guide.new-way.0.1'],
      draw: [{ kind: 'tick', target: '#stage-new .route-gate-t', all: true }] },
    { section: 'new-way', step: 1, anchor: '#stage-new .sc-level', pose: 'point',
      lines: ['guide.new-way.1.0', 'guide.new-way.1.1'],
      draw: [{ kind: 'underline', target: '#stage-new .sc-level' }] },
    { section: 'new-way', step: 2, anchor: '#stage-new .sl-toggle', pose: 'point',
      lines: ['guide.new-way.2.0', 'guide.new-way.2.1'],
      draw: [{ kind: 'arrow', target: '#stage-new .sl-toggle' }] },
    { section: 'new-way', step: 3, anchor: '#stage-new .stage-ledger', pose: 'thumbs',
      lines: ['guide.new-way.3.0', 'guide.new-way.3.1'],
      pop: { from: 'paidOld', to: 'paidNew', label: 'guide.pop.paid' } },

    { section: 'proof', step: 0, anchor: '#stage-proof .rail-col:nth-child(2) .rail-head', pose: 'draw',
      lines: ['guide.proof.0.0'],
      draw: [{ kind: 'tick', target: '#stage-proof .rail-col:nth-child(2) .rail-name' }] },
    { section: 'proof', step: 1, anchor: '#stage-proof .rail-col:nth-child(3) .rail-head', pose: 'draw',
      lines: ['guide.proof.1.0'],
      draw: [{ kind: 'tick', target: '#stage-proof .rail-col:nth-child(-n+3) .rail-name', all: true }] },
    { section: 'proof', step: 2, anchor: '#stage-proof .rail-col:nth-child(4) .rail-head', pose: 'draw',
      lines: ['guide.proof.2.0'],
      draw: [{ kind: 'tick', target: '#stage-proof .rail-col:nth-child(-n+4) .rail-name', all: true }] },
    { section: 'proof', step: 3, anchor: '#stage-proof .rail-col:nth-child(5) .rail-head', pose: 'thumbs',
      lines: ['guide.proof.3.0', 'guide.proof.3.1'],
      draw: [{ kind: 'tick', target: '#stage-proof .rail-name', all: true }] },

    { section: 'simulator', anchor: '#sim-root .sim-presets .sim-preset:last-child', pose: 'point',
      lines: ['guide.simulator.0', 'guide.simulator.1'],
      draw: [{ kind: 'circle', target: '#sim-root .sim-presets .sim-preset:last-child' },
             { kind: 'underline', target: '#sim-root .sim-chips' }] },

    { section: 'calculator', anchor: '#calc-shareAutomated', pose: 'draw', action: 'demoSlider',
      lines: ['guide.calculator.0'],
      draw: [{ kind: 'underline', target: '#calc-root [data-o="hoursFreed"]' }] },

    { section: 'vision', step: 0, anchor: '#stage-vision .stage-figure', pose: 'wave', action: 'flourish',
      lines: ['guide.vision.0.0', 'guide.vision.0.1'] },
    { section: 'vision', step: 1, anchor: '#stage-vision .conv-t', pose: 'draw',
      lines: ['guide.vision.1.0'],
      draw: [{ kind: 'underline', target: '#stage-vision .conv-t' }] },
    { section: 'vision', step: 2, anchor: '#stage-vision .ladder', pose: 'think',
      lines: ['guide.vision.2.0'] },

    { section: 'faq', anchor: '#faq h2', pose: 'idle',
      lines: ['guide.faq.0'] },
    { section: 'cta', anchor: '#cta h2', pose: 'thumbs',
      lines: ['guide.cta.0'] }
  ]
};
