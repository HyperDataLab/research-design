import { z } from 'zod';
import {
  analysisId,
  analysisMethod,
  analysisSchema,
  bankRef,
  conditionId,
  conditionSchema,
  datasetId,
  datasetSchema,
  hypothesisId,
  hypothesisSchema,
  metricId,
  metricSchema,
  variableId,
  variableSchema,
} from '../plan/schema';

/**
 * The editable plan of a project, stored as the `draft` document. It is looser than the frozen plan
 * (`../plan/schema.ts`): lists may be empty and links may be missing while the person is still working.
 * Gói kế hoạch (S10) builds the frozen plan from it. A slice that adds a part of the plan adds its field here
 * with a default, so drafts written earlier still parse.
 */
export const DRAFT_SCHEMA_VERSION = 1;

const text = z.string().trim().min(1);
const localId = (prefix: string) => z.string().regex(new RegExp(`^${prefix}-[1-9][0-9]*$`));
export const questionId = localId('q');
export const threatId = localId('t');
const paperId = z.string().regex(/^p-[0-9a-f]{12}$/);

/** The claim types of Writing Bank (`ct.causal`, `ct.comparative`, …). What a design supports is stated in these. */
export const claimTypeId = z.string().regex(/^ct\.[a-z0-9-]+$/);

export const draftQuestionSchema = z.strictObject({
  id: questionId,
  text,
  /** The gap in earlier work this question answers, in the person's words. Empty until written. */
  gap: z.string().trim(),
  /** Papers of the project (Tập bài báo) the gap was read from. */
  papers: z.array(paperId),
});

export const draftHypothesisSchema = z.strictObject({
  id: hypothesisId.and(localId('h')),
  statement: text,
  kind: hypothesisSchema.shape.kind,
  /** The question this hypothesis answers. */
  question: questionId.nullable(),
  /**
   * What kind of claim confirming the hypothesis would make, chosen by the person from the bank's claim types.
   * A design is checked against it (DS-01). It lives in the draft only: the frozen plan has no field for it
   * yet (see PRD D26).
   */
  claim: claimTypeId.nullable(),
  /** Filled on Đo lường (S8). */
  independent: z.array(variableId),
  dependent: z.array(variableId),
});

export const draftDesignSchema = z.strictObject({
  name: text,
  /**
   * How units reach the conditions in this study. The bank says `either` for some designs; the person then
   * chooses, and until they do this is null (DS-03).
   */
  assignment: z.enum(['random', 'non_random', 'none']).nullable(),
  /** Null for a design the person described themselves. */
  bank: bankRef,
});

export const draftThreatSchema = z.strictObject({
  id: threatId,
  name: text,
  /** What this study does about the threat. Empty until written (DS-04); the bank's general advice is not copied in. */
  mitigation: z.string().trim(),
  bank: bankRef,
});

/**
 * Đo lường (S8). Roles, goals, aggregations and the shapes of ids are the plan's own (`../plan/schema.ts`); what
 * is looser here is that a field may still be empty. `checkChain` says what is missing.
 */
const numbered = (prefix: string) => localId(prefix);

export const draftVariableSchema = z.strictObject({
  id: variableId.and(numbered('v')),
  name: text,
  role: variableSchema.shape.role,
  /** The concept the variable stands for, in the person's words. Draft only: the plan has no field for it yet. */
  construct: z.string().trim(),
  metric: metricId.nullable(),
  levels: z.array(text),
});

export const draftMetricSchema = z.strictObject({
  id: metricId.and(numbered('m')),
  name: text,
  /** The key the runner logs to MLflow. Empty until written; the bank never supplies it. */
  key: z.string().trim(),
  /** Empty until written. The bank's unit is offered when it has one. */
  unit: z.string().trim(),
  /** Null until chosen. The bank's `descriptive` direction leaves it to the person. */
  goal: metricSchema.shape.goal.nullable(),
  aggregation: metricSchema.shape.aggregation.nullable(),
  /** How the value is obtained in this study. A bank protocol is a hint beside it and is not copied in. */
  protocol: z.string().trim(),
  bank: bankRef,
  /** The bank protocol the person follows, if any. Draft only: the plan's metric has no field for it yet. */
  protocolBank: bankRef,
});

export const draftDatasetSchema = z.strictObject({
  id: datasetId.and(numbered('d')),
  name: text,
  /** Where the data comes from. Empty until written. */
  source: z.string().trim(),
  version: datasetSchema.shape.version,
  split: datasetSchema.shape.split,
  sha256: datasetSchema.shape.sha256,
  benchmark: bankRef,
});

export const draftConditionSchema = z.strictObject({
  id: conditionId.and(numbered('c')),
  name: text,
  baseline: z.boolean(),
  params: conditionSchema.shape.params,
});

/**
 * Phân tích thống kê and Ma trận chạy (S9). Methods, missing-data policies, corrections and the bounds of alpha
 * are the plan's own. `conditions` of an analysis is ordered: the plan compares them in that order.
 */
export const draftAnalysisSchema = z.strictObject({
  id: analysisId.and(numbered('a')),
  /** Null for an analysis that tests no hypothesis (a descriptive summary, say). */
  hypothesis: hypothesisId.nullable(),
  /** Null until chosen. */
  method: analysisMethod.nullable(),
  variables: z.array(variableId),
  conditions: z.array(conditionId),
  parameters: analysisSchema.shape.parameters,
  assumptions: z.array(text),
  missingPolicy: analysisSchema.shape.missingPolicy,
  alpha: analysisSchema.shape.alpha,
  correction: analysisSchema.shape.correction,
});

/** The most seeds a grid may list. A confirmatory grid is written out; this is not a search. */
export const MAX_SEEDS = 200;

/**
 * The confirmatory grid: every listed condition on every listed dataset with every seed. The number of runs is
 * always computed from the three lists (`runCount`) and is not stored, so it cannot disagree with them.
 */
export const draftRunMatrixSchema = z.strictObject({
  mlflowExperiment: z.string().trim(),
  conditions: z.array(conditionId),
  datasets: z.array(datasetId),
  seeds: z.array(z.number().int().nonnegative()).max(MAX_SEEDS),
  sampleSizeJustification: z.string().trim(),
});
export const emptyRunMatrix = (): z.infer<typeof draftRunMatrixSchema> => ({
  mlflowExperiment: '',
  conditions: [],
  datasets: [],
  seeds: [],
  sampleSizeJustification: '',
});
export const runCount = (matrix: z.infer<typeof draftRunMatrixSchema>): number =>
  matrix.conditions.length * matrix.datasets.length * matrix.seeds.length;

const counter = z.number().int().positive();

export const draftSchema = z.strictObject({
  schemaVersion: z.literal(DRAFT_SCHEMA_VERSION),
  /** The plan's title. Empty until written; the project's title is used then. Added with Gói kế hoạch (S10). */
  planTitle: z.string().trim().default(''),
  /** The next number for each id prefix. A number is used once, so a deleted object's id never comes back. */
  next: z.strictObject({
    q: counter,
    h: counter,
    t: counter,
    // Added with Đo lường (S8); a draft written before it has none of these.
    v: counter.default(1),
    m: counter.default(1),
    d: counter.default(1),
    c: counter.default(1),
    // Added with Phân tích thống kê (S9).
    a: counter.default(1),
  }),
  questions: z.array(draftQuestionSchema),
  hypotheses: z.array(draftHypothesisSchema),
  design: draftDesignSchema.nullable(),
  threats: z.array(draftThreatSchema),
  variables: z.array(draftVariableSchema).default([]),
  metrics: z.array(draftMetricSchema).default([]),
  datasets: z.array(draftDatasetSchema).default([]),
  conditions: z.array(draftConditionSchema).default([]),
  analyses: z.array(draftAnalysisSchema).default([]),
  runMatrix: draftRunMatrixSchema.default(emptyRunMatrix),
});
export type Draft = z.infer<typeof draftSchema>;
export type DraftQuestion = Draft['questions'][number];
export type DraftHypothesis = Draft['hypotheses'][number];
export type DraftDesign = NonNullable<Draft['design']>;
export type DraftThreat = Draft['threats'][number];
export type DraftVariable = Draft['variables'][number];
export type DraftMetric = Draft['metrics'][number];
export type DraftDataset = Draft['datasets'][number];
export type DraftCondition = Draft['conditions'][number];
export type DraftAnalysis = Draft['analyses'][number];
export type DraftRunMatrix = Draft['runMatrix'];

export const emptyDraft = (): Draft => ({
  schemaVersion: DRAFT_SCHEMA_VERSION,
  planTitle: '',
  next: { q: 1, h: 1, t: 1, v: 1, m: 1, d: 1, c: 1, a: 1 },
  questions: [],
  hypotheses: [],
  design: null,
  threats: [],
  variables: [],
  metrics: [],
  datasets: [],
  conditions: [],
  analyses: [],
  runMatrix: emptyRunMatrix(),
});
