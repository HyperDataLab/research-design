import { describe, expect, it } from 'vitest';
import { emptyDraft, draftSchema, type Draft } from './schema';
import {
  addAnalysis,
  editAnalysis,
  removeAnalysis,
  setRunMatrix,
  parseSeeds,
  formatSeeds,
  gridCells,
} from './planOps';
import { checkPlan } from './checkPlan';
import { draftToPlan } from './toPlan';
import { removeCondition, removeDataset, removeVariable, users } from './measureOps';
import { removeHypothesis } from './ops';

const analysis = {
  hypothesis: 'h-1',
  method: 'ttest_welch' as const,
  variables: ['v-1'],
  conditions: ['c-2', 'c-1'],
  parameters: {},
  assumptions: [],
  missingPolicy: 'listwise' as const,
  alpha: 0.05,
  correction: 'none' as const,
};
function fixture(): Draft {
  const d = emptyDraft();
  d.hypotheses = [
    {
      id: 'h-1',
      statement: 'A',
      kind: 'directional',
      question: null,
      claim: null,
      independent: [],
      dependent: ['v-1'],
    },
  ];
  d.variables = [{ id: 'v-1', name: 'V', role: 'dependent', construct: '', metric: 'm-1', levels: [] }];
  d.metrics = [
    {
      id: 'm-1',
      name: 'M',
      key: 'score',
      unit: 'unit',
      goal: 'maximize',
      aggregation: 'mean',
      protocol: 'Protocol',
      bank: null,
      protocolBank: null,
    },
  ];
  d.conditions = [
    { id: 'c-1', name: 'One', baseline: true, params: {} },
    { id: 'c-2', name: 'Two', baseline: false, params: {} },
  ];
  d.datasets = [
    { id: 'd-1', name: 'Data', source: 'source', version: null, split: null, sha256: null, benchmark: null },
  ];
  return d;
}
const matrix = {
  mlflowExperiment: 'study',
  conditions: ['c-1', 'c-2'],
  datasets: ['d-1'],
  seeds: [1, 0],
  sampleSizeJustification: 'enough',
};
const unwrap = (r: ReturnType<typeof addAnalysis>) => {
  if (!r.ok) throw Error(r.error);
  return r.doc;
};

describe('planning operations', () => {
  it.each([
    [
      'AN-01',
      (d: Draft) => {
        d.analyses = [];
      },
    ],
    [
      'AN-02',
      (d: Draft) => {
        d.analyses[0]!.method = null;
      },
    ],
    [
      'AN-03',
      (d: Draft) => {
        d.analyses[0]!.variables = [];
      },
    ],
    [
      'AN-04',
      (d: Draft) => {
        d.analyses[0]!.conditions = ['c-1'];
      },
    ],
    [
      'AN-05',
      (d: Draft) => {
        d.runMatrix.conditions = ['c-1'];
      },
    ],
    [
      'AN-06',
      (d: Draft) => {
        d.analyses[0]!.variables = ['v-99'];
      },
    ],
    [
      'AN-07',
      (d: Draft) => {
        d.analyses[0]!.method = 'anova_oneway';
      },
    ],
    [
      'RM-01',
      (d: Draft) => {
        d.runMatrix.seeds = [];
      },
    ],
    [
      'RM-02',
      (d: Draft) => {
        d.runMatrix.datasets = ['d-99'];
      },
    ],
    [
      'RM-03',
      (d: Draft) => {
        d.conditions[0]!.baseline = false;
      },
    ],
  ])('%s appears for a defect and disappears when corrected', (rule, change) => {
    let d = unwrap(addAnalysis(fixture(), analysis));
    d = unwrap(setRunMatrix(d, matrix));
    expect(checkPlan(d).some((f) => f.rule === rule)).toBe(false);
    change(d);
    expect(checkPlan(d).some((f) => f.rule === rule)).toBe(true);
  });
  it('PO-01 preserves comparison order, normalizes and never reuses ids', () => {
    let d = fixture();
    d = unwrap(
      addAnalysis(d, {
        ...analysis,
        variables: ['v-1', 'v-1'],
        conditions: ['c-2', 'c-1', 'c-2'],
        assumptions: [' a ', ' '],
        parameters: { ' x ': 1 },
      }),
    );
    expect(d.analyses[0]).toMatchObject({
      conditions: ['c-2', 'c-1'],
      variables: ['v-1'],
      assumptions: ['a'],
      parameters: { x: 1 },
    });
    expect(draftSchema.parse(d)).toEqual(d);
    expect(unwrap(editAnalysis(d, 'a-1', d.analyses[0]!))).toBe(d);
    d = unwrap(removeAnalysis(d, 'a-1'));
    expect(unwrap(addAnalysis(d, analysis)).analyses[0]?.id).toBe('a-2');
  });
  it('PO-02 rejects bad links and inputs', () => {
    const d = fixture();
    const bad: [Partial<typeof analysis>, string][] = [
      [{ hypothesis: 'h-9' }, 'unknown_hypothesis'],
      [{ variables: ['v-9'] }, 'unknown_variable'],
      [{ conditions: ['c-9'] }, 'unknown_condition'],
      [{ alpha: 1 }, 'invalid_alpha'],
      [{ parameters: { ' ': 1 } }, 'invalid_text'],
    ];
    for (const [input, error] of bad)
      expect(addAnalysis(d, { ...analysis, ...input })).toMatchObject({ error });
    expect(removeAnalysis(d, 'a-9')).toMatchObject({ error: 'unknown_analysis' });
    expect(setRunMatrix(d, { ...matrix, datasets: ['d-9'] })).toMatchObject({ error: 'unknown_dataset' });
    expect(setRunMatrix(d, { ...matrix, conditions: ['c-9'] })).toMatchObject({ error: 'unknown_condition' });
    expect(setRunMatrix(d, { ...matrix, seeds: Array.from({ length: 201 }, (_, i) => i) })).toMatchObject({
      error: 'too_many_seeds',
    });
  });
  it('PO-03 parses and formats seeds and previews grid tags', () => {
    expect(parseSeeds('0-4, 7 2')).toEqual({ ok: true, seeds: [0, 1, 2, 3, 4, 7] });
    expect(parseSeeds('3-1')).toMatchObject({ error: 'invalid_seeds' });
    expect(parseSeeds('0-200')).toMatchObject({ error: 'too_many_seeds' });
    expect(formatSeeds([7, 4, 3, 2, 1, 0])).toBe('0-4, 7');
    const d = unwrap(setRunMatrix(fixture(), matrix));
    expect(gridCells(d, 1)).toEqual({
      total: 4,
      cells: [
        {
          condition: 'c-1',
          dataset: 'd-1',
          seed: 0,
          tags: { 'plan.condition_id': 'c-1', 'plan.dataset_id': 'd-1', 'plan.seed': '0' },
        },
      ],
    });
    expect(unwrap(setRunMatrix(d, { ...matrix, seeds: [0, 1] }))).toBe(d);
  });
  it('DL-01 refuses deleting referenced objects', () => {
    let d = unwrap(addAnalysis(fixture(), analysis));
    d = unwrap(setRunMatrix(d, matrix));
    expect(users(d, 'c-1')).toEqual(['a-1', 'runMatrix']);
    expect(removeHypothesis(d, 'h-1')).toMatchObject({ error: 'in_use' });
    expect(removeVariable(d, 'v-1')).toMatchObject({ error: 'in_use' });
    expect(removeCondition(d, 'c-1')).toMatchObject({ error: 'in_use' });
    expect(removeDataset(d, 'd-1')).toMatchObject({ error: 'in_use' });
  });
  it('OLD-01 supplies defaults for earlier drafts', () => {
    const { analyses, runMatrix, next, ...rest } = fixture();
    void analyses;
    void runMatrix;
    const { a, ...oldNext } = next;
    void a;
    const d = draftSchema.parse({ ...rest, next: oldNext });
    expect(addAnalysis(d, analysis).ok).toBe(true);
    expect(setRunMatrix(d, matrix).ok).toBe(true);
  });
  it('TP-01 maps a complete draft into an unblocked plan', async () => {
    const { validatePlan } = await import('../plan/validatePlan');
    const { checkChain } = await import('./checkChain');
    let d = unwrap(addAnalysis(fixture(), analysis));
    d = unwrap(setRunMatrix(d, matrix));
    expect(checkChain(d)).toEqual([]);
    expect(checkPlan(d).filter((f) => f.level === 'warning')).toEqual([]);
    const result = draftToPlan(d, {
      planId: 'plan',
      planVersion: 1,
      title: 'Title',
      frozenAt: '2026-01-01T00:00:00Z',
      frozenBy: 'person',
      deviation: null,
      appVersion: '1',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(validatePlan(result.plan).filter((i) => i.level === 'blocking')).toEqual([]);
  });
  it('TP-02 warnings for missing analysis, comparison and grid cannot pass the gate', async () => {
    const { validatePlan } = await import('../plan/validatePlan');
    const meta = {
      planId: 'plan',
      planVersion: 1,
      title: 'Title',
      frozenAt: '2026-01-01T00:00:00Z',
      frozenBy: 'person',
      deviation: null,
      appVersion: '1',
    };
    for (const [rule, change] of [
      [
        'AN-01',
        (d: Draft) => {
          d.analyses = [];
        },
      ],
      [
        'AN-04',
        (d: Draft) => {
          d.analyses[0]!.conditions = ['c-1'];
        },
      ],
      [
        'AN-05',
        (d: Draft) => {
          d.runMatrix.conditions = ['c-1'];
        },
      ],
      [
        'RM-01',
        (d: Draft) => {
          d.runMatrix.seeds = [];
        },
      ],
    ] as [string, (d: Draft) => void][]) {
      let d = unwrap(addAnalysis(fixture(), analysis));
      d = unwrap(setRunMatrix(d, matrix));
      change(d);
      expect(checkPlan(d).some((f) => f.rule === rule)).toBe(true);
      const result = draftToPlan(d, meta);
      expect(!result.ok || validatePlan(result.plan).some((i) => i.level === 'blocking')).toBe(true);
    }
  });
});
