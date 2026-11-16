import { RUN_TAGS, SRD_P0_METHODS, type ExperimentPlan } from './schema';

/** Methods that compare exactly two conditions. */
export const TWO_SAMPLE: readonly string[] = [
  'ttest_independent',
  'ttest_paired',
  'ttest_welch',
  'mann_whitney',
  'wilcoxon_signed_rank',
];

/** The freeze gate. A plan with a blocking issue cannot be frozen; a warning is shown and can be accepted. */
export interface PlanIssue {
  rule: string;
  level: 'blocking' | 'warning';
  message: string;
  /** The id of the plan object the issue is about, when there is one. */
  subject?: string;
}

const P0: readonly string[] = SRD_P0_METHODS;

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const value of values) (seen.has(value) ? twice : seen).add(value);
  return [...twice];
}

export function validatePlan(plan: ExperimentPlan): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const block = (rule: string, message: string, subject?: string) =>
    issues.push({ rule, level: 'blocking', message, subject });
  const warn = (rule: string, message: string, subject?: string) =>
    issues.push({ rule, level: 'warning', message, subject });

  const collections = {
    hypothesis: plan.hypotheses,
    variable: plan.variables,
    metric: plan.metrics,
    dataset: plan.datasets,
    condition: plan.conditions,
    analysis: plan.analyses,
  };
  // PP-01: an id names one object.
  for (const [kind, items] of Object.entries(collections))
    for (const id of duplicates(items.map((item) => item.id)))
      block('PP-01', `Two ${kind} entries share the id ${id}.`, id);

  const ids = Object.fromEntries(
    Object.entries(collections).map(([kind, items]) => [kind, new Set(items.map((item) => item.id))]),
  ) as Record<keyof typeof collections, Set<string>>;
  // PP-02: every reference resolves inside the plan.
  const need = (kind: keyof typeof collections, id: string, from: string) => {
    if (!ids[kind].has(id)) block('PP-02', `${from} refers to the missing ${kind} ${id}.`, from);
  };
  for (const hypothesis of plan.hypotheses)
    for (const id of [...hypothesis.independent, ...hypothesis.dependent])
      need('variable', id, hypothesis.id);
  for (const variable of plan.variables) if (variable.metric) need('metric', variable.metric, variable.id);
  for (const id of plan.runMatrix.conditions) need('condition', id, 'runMatrix');
  for (const id of plan.runMatrix.datasets) need('dataset', id, 'runMatrix');
  for (const analysis of plan.analyses) {
    if (analysis.hypothesis) need('hypothesis', analysis.hypothesis, analysis.id);
    for (const id of analysis.variables) need('variable', id, analysis.id);
    for (const id of analysis.conditions) need('condition', id, analysis.id);
  }
  for (const question of plan.context?.questions ?? [])
    for (const id of question.hypotheses) need('hypothesis', id, question.id);
  for (const claim of plan.context?.claims ?? []) need('hypothesis', claim.hypothesis, 'context.claims');
  for (const item of plan.context?.constructs ?? []) need('variable', item.variable, 'context.constructs');
  for (const item of plan.context?.metricProtocols ?? [])
    need('metric', item.metric, 'context.metricProtocols');

  // PP-03: the grid is what it says it is.
  const { conditions, datasets, seeds, expectedRuns } = plan.runMatrix;
  for (const [name, list] of [
    ['conditions', conditions],
    ['datasets', datasets],
    ['seeds', seeds.map(String)],
  ] as const)
    for (const value of duplicates(list))
      block('PP-03', `runMatrix.${name} lists ${value} twice.`, 'runMatrix');
  const cells = conditions.length * datasets.length * seeds.length;
  if (cells !== expectedRuns)
    block('PP-03', `expectedRuns is ${expectedRuns} but the grid has ${cells} cells.`, 'runMatrix');

  // PP-04: one MLflow key per metric, and none that collides with the plan's own tags.
  for (const key of duplicates(plan.metrics.map((metric) => metric.key)))
    block('PP-04', `Two metrics log to the MLflow key "${key}".`);
  const reserved: string[] = Object.values(RUN_TAGS);
  for (const metric of plan.metrics)
    if (reserved.includes(metric.key)) block('PP-04', `"${metric.key}" is reserved for run tags.`, metric.id);

  // PP-05: a confirmatory hypothesis has a pre-specified analysis.
  for (const hypothesis of plan.hypotheses)
    if (
      hypothesis.kind !== 'exploratory' &&
      !plan.analyses.some((analysis) => analysis.hypothesis === hypothesis.id)
    )
      block('PP-05', `${hypothesis.id} has no pre-specified analysis.`, hypothesis.id);

  // PP-06: what is measured can be measured.
  const byId = new Map(plan.variables.map((variable) => [variable.id, variable]));
  for (const hypothesis of plan.hypotheses)
    for (const id of hypothesis.dependent) {
      const variable = byId.get(id);
      if (variable && !variable.metric)
        block('PP-06', `Dependent variable ${id} of ${hypothesis.id} has no metric.`, id);
    }

  // PP-07: a comparison needs something to compare with.
  if (plan.runMatrix.conditions.length > 1) {
    const inGrid = plan.conditions.filter((condition) => plan.runMatrix.conditions.includes(condition.id));
    if (!inGrid.some((condition) => condition.baseline))
      warn('PP-07', 'The run matrix compares conditions but none is marked as the baseline.', 'runMatrix');
  }

  // PP-08: SRD P0 runs only descriptive statistics, t-tests and correlations.
  for (const analysis of plan.analyses)
    if (!P0.includes(analysis.method))
      warn('PP-08', `${analysis.id} uses ${analysis.method}, which SRD plans for P1.`, analysis.id);

  // PP-09: a later version says how it differs from the one before.
  if (plan.planVersion > 1 && !plan.deviation)
    block('PP-09', `Version ${plan.planVersion} must state its deviation from the previous version.`);
  if (plan.planVersion === 1 && plan.deviation)
    block('PP-09', 'Version 1 has no previous version to deviate from.');

  // PP-10: an analysis compares conditions that are actually run, and as many as its method takes.
  for (const analysis of plan.analyses) {
    for (const id of analysis.conditions)
      if (ids.condition.has(id) && !plan.runMatrix.conditions.includes(id))
        block('PP-10', `${analysis.id} compares ${id}, which is not in the run matrix.`, analysis.id);
    if (TWO_SAMPLE.includes(analysis.method) && analysis.conditions.length !== 2)
      block(
        'PP-10',
        `${analysis.id} uses ${analysis.method}, which compares exactly two conditions.`,
        analysis.id,
      );
  }

  return issues;
}

export function canFreeze(plan: ExperimentPlan): boolean {
  return validatePlan(plan).every((issue) => issue.level !== 'blocking');
}

/** The tags the runner sets on the MLflow run of one grid cell. */
export function runTags(
  plan: Pick<ExperimentPlan, 'planId' | 'planVersion'>,
  cell: { condition: string; dataset: string; seed: number },
): Record<string, string> {
  return {
    [RUN_TAGS.planId]: plan.planId,
    [RUN_TAGS.planVersion]: String(plan.planVersion),
    [RUN_TAGS.condition]: cell.condition,
    [RUN_TAGS.dataset]: cell.dataset,
    [RUN_TAGS.seed]: String(cell.seed),
  };
}
