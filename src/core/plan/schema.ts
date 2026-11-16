import { z } from 'zod';

/**
 * ExperimentPlanPackage v1: the plan this app freezes and Scientific Research Desktop (SRD) reads.
 * Status: proposed. SRD's own spec is a proposed baseline, so this contract is a change request to it
 * (docs/CONTRACTS.md). The normative part holds what SRD's objects consume plus the ids that let a result
 * be traced back to the plan; everything else sits in the optional `context` block.
 */
export const PLAN_FORMAT = 'experiment-plan-package';
export const PLAN_SCHEMA_VERSION = 1;

/** Plan-local ids. Their prefixes differ from Writing Bank's (`met.`, `rd.`, `thr.`) on purpose. */
const localId = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}-[a-z0-9]+(?:-[a-z0-9]+)*$`), `expected ${prefix}-<slug>`);
export const hypothesisId = localId('h');
export const variableId = localId('v');
export const metricId = localId('m');
export const datasetId = localId('d');
export const conditionId = localId('c');
export const analysisId = localId('a');

const isoTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/, 'expected a UTC ISO time');
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const text = z.string().trim().min(1);

/**
 * A reference to a Writing Bank entry. The bank's entries are still drafts and its API is not live, so a
 * reference is optional and always names the release it was read from.
 */
export const bankRef = z.strictObject({ id: text, release: text }).nullable();

/** Methods SRD ships in P0 (FR-401..403). A plan may name a P1 method; the gate then warns (PP-08). */
export const SRD_P0_METHODS = [
  'descriptive',
  'ttest_independent',
  'ttest_paired',
  'ttest_welch',
  'correlation_pearson',
  'correlation_spearman',
] as const;
export const SRD_P1_METHODS = [
  'anova_oneway',
  'anova_repeated',
  'mann_whitney',
  'wilcoxon_signed_rank',
  'kruskal_wallis',
  'friedman',
  'posthoc_pairwise',
  'regression_linear',
  'reliability',
] as const;
export const analysisMethod = z.enum([...SRD_P0_METHODS, ...SRD_P1_METHODS]);

export const hypothesisSchema = z.strictObject({
  id: hypothesisId,
  statement: text,
  /** `exploratory` hypotheses need no pre-specified analysis; the others do (PP-05). */
  kind: z.enum(['directional', 'non_directional', 'equivalence', 'exploratory']),
  independent: z.array(variableId),
  dependent: z.array(variableId).min(1),
});

export const variableSchema = z.strictObject({
  id: variableId,
  name: text,
  role: z.enum(['independent', 'dependent', 'control', 'covariate']),
  /** The metric that measures a dependent variable or covariate. */
  metric: metricId.nullable(),
  /** Levels of a manipulated factor, by name. */
  levels: z.array(text),
});

export const metricSchema = z.strictObject({
  id: metricId,
  name: text,
  /** The key the runner logs to MLflow. One key per metric (PP-04). */
  key: z.string().regex(/^[A-Za-z0-9_\-. /]{1,250}$/),
  unit: text,
  goal: z.enum(['maximize', 'minimize', 'target']),
  /** How one run's metric history becomes the one value the analysis uses. */
  aggregation: z.enum(['last', 'max', 'min', 'mean']),
  /** How the value is obtained: split, averaging, tool and version. */
  protocol: text,
  bank: bankRef,
});

export const datasetSchema = z.strictObject({
  id: datasetId,
  name: text,
  source: text,
  version: z.string().nullable(),
  split: z.string().nullable(),
  sha256: sha256.nullable(),
  benchmark: bankRef,
});

export const conditionSchema = z.strictObject({
  id: conditionId,
  name: text,
  baseline: z.boolean(),
  /** Logged as MLflow params. */
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});

/**
 * The confirmatory runs: an explicit grid, every condition on every dataset with every seed. Search methods
 * and early stopping are for tuning and have no place in a pre-specified plan.
 */
export const runMatrixSchema = z.strictObject({
  mlflowExperiment: text,
  conditions: z.array(conditionId).min(1),
  datasets: z.array(datasetId).min(1),
  seeds: z.array(z.number().int().nonnegative()).min(1),
  /** conditions × datasets × seeds (PP-03). Written out so a reader does not have to multiply. */
  expectedRuns: z.number().int().positive(),
  /** Why this many runs is enough. A power calculation is not built in v1. */
  sampleSizeJustification: text,
});

/** Mirrors SRD's AnalysisSpecification: method, variables, parameters, assumptions, missing_policy. */
export const analysisSchema = z.strictObject({
  id: analysisId,
  hypothesis: hypothesisId.nullable(),
  method: analysisMethod,
  variables: z.array(variableId).min(1),
  /** Conditions compared, in order. Empty when the method compares none (descriptive, correlation). */
  conditions: z.array(conditionId),
  parameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  assumptions: z.array(text),
  missingPolicy: z.enum(['listwise', 'pairwise', 'fail']),
  alpha: z.number().gt(0).lt(1),
  correction: z.enum(['none', 'bonferroni', 'holm', 'fdr_bh']),
});

/** Why the plan looks the way it does. SRD may ignore this block. */
export const contextSchema = z.strictObject({
  questions: z.array(
    z.strictObject({
      id: localId('q'),
      text,
      /** The gap in earlier work the question answers, in the person's words. */
      gap: z.string().trim().min(1).nullable(),
      hypotheses: z.array(hypothesisId),
    }),
  ),
  /** What kind of claim confirming a hypothesis would make: a Writing Bank claim type (`ct.causal`, …). */
  claims: z.array(z.strictObject({ hypothesis: hypothesisId, claimType: text })),
  /** The concept a variable stands for. */
  constructs: z.array(z.strictObject({ variable: variableId, construct: text })),
  /** The Writing Bank protocol a metric's measurement follows. */
  metricProtocols: z.array(
    z.strictObject({ metric: metricId, protocol: z.strictObject({ id: text, release: text }) }),
  ),
  design: z
    .strictObject({ name: text, assignment: z.enum(['random', 'non_random', 'none']), bank: bankRef })
    .nullable(),
  threats: z.array(z.strictObject({ name: text, mitigation: text, bank: bankRef })),
  /** Papers the plan rests on. `sourceHash` is `document.source.sha256` of PaperLab's paper model, as it came. */
  sources: z.array(
    z.strictObject({ title: text, doi: z.string().nullable(), sourceHash: z.string().nullable() }),
  ),
});

export const planSchema = z.strictObject({
  format: z.literal(PLAN_FORMAT),
  schemaVersion: z.literal(PLAN_SCHEMA_VERSION),
  planId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  /** Starts at 1. A frozen plan is never edited: a change is the next version, with `deviation` filled. */
  planVersion: z.number().int().positive(),
  title: text,
  frozenAt: isoTime,
  /** The signed-in lab account that froze the plan. Freezing is always a person's action. */
  frozenBy: text,
  /** What changed from the previous version and why. Null only on version 1 (PP-09). */
  deviation: z.string().trim().min(1).nullable(),
  generator: z.strictObject({ app: z.literal('research-design'), version: text }),
  hypotheses: z.array(hypothesisSchema).min(1),
  variables: z.array(variableSchema).min(1),
  metrics: z.array(metricSchema).min(1),
  datasets: z.array(datasetSchema).min(1),
  conditions: z.array(conditionSchema).min(1),
  runMatrix: runMatrixSchema,
  analyses: z.array(analysisSchema),
  context: contextSchema.nullable(),
});
export type ExperimentPlan = z.infer<typeof planSchema>;

/** `manifest.json` of the package ZIP: what is inside and the hash of each file. */
export const manifestSchema = z.strictObject({
  format: z.literal(PLAN_FORMAT),
  schemaVersion: z.literal(PLAN_SCHEMA_VERSION),
  planId: text,
  planVersion: z.number().int().positive(),
  files: z.array(z.strictObject({ path: text, sha256 })).min(1),
});
export type PlanManifest = z.infer<typeof manifestSchema>;

/**
 * MLflow run tags that carry the plan's ids into the runner. SRD reads MLflow through its SDK only, so tags
 * are the one place a run can say which cell of which plan it is. The prefix is `plan.`, not `rd.`, which
 * Writing Bank uses for its design ids.
 */
export const RUN_TAGS = {
  planId: 'plan.id',
  planVersion: 'plan.version',
  condition: 'plan.condition_id',
  dataset: 'plan.dataset_id',
  seed: 'plan.seed',
} as const;
