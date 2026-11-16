export const snapshot = {
  format: 'writing-bank-snapshot',
  formatVersion: 1,
  source: 'Synthetic source',
  collections: {
    designs: [
      {
        id: 'rd.test-experiment',
        name: 'Test experiment',
        family: 'test',
        definition: 'An invented design.',
        assignment: 'random',
        causalLicence: 'test',
        supports: ['ct.causal', 'ct.comparative'],
        threats: ['vt.test-confound'],
      },
      {
        id: 'rd.test-benchmark',
        name: 'Test benchmark',
        family: 'test',
        definition: 'Another invented design.',
        assignment: 'either',
        causalLicence: 'test',
        supports: ['ct.comparative', 'ct.descriptive'],
      },
    ],
    threats: [
      {
        id: 'vt.test-confound',
        name: 'Test confound',
        type: 'test',
        mechanism: 'Invented mechanism.',
        mitigation: 'Invented mitigation.',
      },
    ],
    'claim-types': [
      { id: 'ct.causal', name: 'Causal', definition: 'Invented causal claim.' },
      { id: 'ct.comparative', name: 'Comparative', definition: 'Invented comparative claim.' },
      { id: 'ct.descriptive', name: 'Descriptive', definition: 'Invented descriptive claim.' },
    ],
    metrics: [
      {
        id: 'met.test-score',
        name: 'Test score',
        aliases: ['Invented alias'],
        family: 'classification',
        definition: 'An invented metric.',
        unit: 'points',
        direction: 'higher_better',
      },
      {
        id: 'met.test-shape',
        name: 'Test shape',
        family: 'regression',
        definition: 'Another invented metric.',
        unit: null,
        direction: 'descriptive',
      },
    ],
    protocols: [
      {
        id: 'mp.test-procedure',
        name: 'Test procedure',
        purpose: 'An invented procedure.',
        metrics: ['met.test-score'],
      },
    ],
    benchmarks: [
      {
        id: 'bm.test-suite',
        name: 'Test suite',
        task: 'An invented task.',
        metrics: ['met.test-score'],
        lifecycle: 'saturated',
        knownFlaws: ['An invented flaw.'],
      },
    ],
  },
};
