import { examplePlan } from './examplePlan';
import { planSchema, RUN_TAGS } from './schema';
import { canFreeze, runTags, validatePlan } from './validatePlan';

const rules = (plan: ReturnType<typeof examplePlan>, level?: 'blocking' | 'warning') =>
  validatePlan(plan)
    .filter((issue) => !level || issue.level === level)
    .map((issue) => issue.rule);

describe('ExperimentPlanPackage v1', () => {
  it('the example plan parses and passes the freeze gate', () => {
    const plan = planSchema.parse(examplePlan());
    expect(validatePlan(plan)).toEqual([]);
    expect(canFreeze(plan)).toBe(true);
  });

  it('refuses unknown fields, unknown versions and bank-style ids', () => {
    expect(planSchema.safeParse({ ...examplePlan(), extra: 1 }).success).toBe(false);
    expect(planSchema.safeParse({ ...examplePlan(), schemaVersion: 2 }).success).toBe(false);
    const plan = examplePlan();
    plan.metrics[0]!.id = 'met.accuracy';
    expect(planSchema.safeParse(plan).success).toBe(false);
  });

  it('PP-01: duplicate ids block', () => {
    const plan = examplePlan();
    plan.metrics[1]!.id = 'm-accuracy';
    expect(rules(plan, 'blocking')).toContain('PP-01');
  });

  it('PP-02: a dangling reference inside the context block blocks too', () => {
    const edits: ((plan: ReturnType<typeof examplePlan>) => void)[] = [
      (plan) => plan.context!.claims.push({ hypothesis: 'h-gone', claimType: 'ct.causal' }),
      (plan) => plan.context!.constructs.push({ variable: 'v-gone', construct: 'Something' }),
      (plan) =>
        plan.context!.metricProtocols.push({
          metric: 'm-gone',
          protocol: { id: 'mp.test-procedure', release: 'sha256:0000000000000000' },
        }),
    ];
    for (const edit of edits) {
      const plan = examplePlan();
      edit(plan);
      expect(planSchema.safeParse(plan).success).toBe(true);
      expect(rules(plan, 'blocking')).toContain('PP-02');
    }
  });

  it('PP-02: a dangling reference blocks, wherever it is', () => {
    const cases: ((plan: ReturnType<typeof examplePlan>) => void)[] = [
      (plan) => plan.hypotheses[0]!.dependent.push('v-missing'),
      (plan) => (plan.variables[1]!.metric = 'm-missing'),
      (plan) => plan.runMatrix.datasets.push('d-missing'),
      (plan) => (plan.analyses[0]!.hypothesis = 'h-missing'),
      (plan) => plan.analyses[0]!.conditions.push('c-missing'),
      (plan) => plan.context!.questions[0]!.hypotheses.push('h-missing'),
    ];
    for (const change of cases) {
      const plan = examplePlan();
      change(plan);
      expect(rules(plan, 'blocking')).toContain('PP-02');
    }
  });

  it('PP-03: the grid must match expectedRuns and list nothing twice', () => {
    const plan = examplePlan();
    plan.runMatrix.expectedRuns = 29;
    expect(rules(plan, 'blocking')).toEqual(['PP-03']);
    const repeated = examplePlan();
    repeated.runMatrix.seeds = [0, 0, 1, 2, 3, 4, 5, 6, 7, 8];
    expect(rules(repeated, 'blocking')).toContain('PP-03');
  });

  it('PP-04: MLflow keys are unique and do not collide with run tags', () => {
    const plan = examplePlan();
    plan.metrics[1]!.key = plan.metrics[0]!.key;
    expect(rules(plan, 'blocking')).toEqual(['PP-04']);
    const reserved = examplePlan();
    reserved.metrics[1]!.key = RUN_TAGS.seed;
    expect(rules(reserved, 'blocking')).toEqual(['PP-04']);
  });

  it('PP-05: a confirmatory hypothesis needs an analysis; an exploratory one does not', () => {
    const plan = examplePlan();
    plan.analyses = [];
    expect(validatePlan(plan).map((issue) => issue.subject)).toEqual(['h-accuracy']);
    expect(canFreeze(plan)).toBe(false);
  });

  it('PP-06: a dependent variable without a metric blocks', () => {
    const plan = examplePlan();
    plan.variables[1]!.metric = null;
    expect(rules(plan, 'blocking')).toEqual(['PP-06']);
  });

  it('PP-07 and PP-08 warn and do not block the freeze', () => {
    const plan = examplePlan();
    plan.conditions[0]!.baseline = false;
    plan.analyses[0]!.method = 'anova_oneway';
    expect(rules(plan).sort()).toEqual(['PP-07', 'PP-08']);
    expect(canFreeze(plan)).toBe(true);
  });

  it('PP-09: a later version states its deviation; version 1 has none', () => {
    const later = { ...examplePlan(), planVersion: 2 };
    expect(rules(later, 'blocking')).toEqual(['PP-09']);
    expect(rules({ ...later, deviation: 'Added two seeds after a pilot.' })).toEqual([]);
    expect(rules({ ...examplePlan(), deviation: 'x' }, 'blocking')).toEqual(['PP-09']);
  });

  it('PP-10: compared conditions are in the run matrix, two for a two-sample test', () => {
    const outside = examplePlan();
    outside.runMatrix.conditions = ['c-bm25', 'c-dense'];
    outside.runMatrix.expectedRuns = 20;
    expect(rules(outside, 'blocking')).toEqual(['PP-10']);
    const three = examplePlan();
    three.analyses[0]!.conditions.push('c-dense');
    expect(rules(three, 'blocking')).toEqual(['PP-10']);
  });

  it('run tags carry the plan id, version and grid cell', () => {
    expect(runTags(examplePlan(), { condition: 'c-bm25', dataset: 'd-main', seed: 3 })).toEqual({
      'plan.id': 'retrieval-reranker',
      'plan.version': '1',
      'plan.condition_id': 'c-bm25',
      'plan.dataset_id': 'd-main',
      'plan.seed': '3',
    });
  });
});
