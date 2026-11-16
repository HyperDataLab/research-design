import type { BankMetric, BankBenchmark } from '../bank/snapshot';
import {
  draftVariableSchema,
  draftMetricSchema,
  draftDatasetSchema,
  draftConditionSchema,
  type Draft,
  type DraftVariable,
  type DraftMetric,
  type DraftDataset,
  type DraftCondition,
} from './schema';
import type { DraftError, DraftResult } from './ops';

type Variable = Omit<DraftVariable, 'id'>;
type Metric = Omit<DraftMetric, 'id'>;
type Dataset = Omit<DraftDataset, 'id'>;
type Condition = Omit<DraftCondition, 'id'>;
const ok = (doc: Draft): DraftResult => ({ ok: true, doc });
const fail = (error: DraftError): DraftResult => ({ ok: false, error });
const same = (a: unknown, b: unknown) => {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, canonical(item)]),
      );
    return value;
  };
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
};

export function users(doc: Draft, id: string): string[] {
  return [
    ...doc.hypotheses.filter((h) => h.independent.includes(id) || h.dependent.includes(id)).map((h) => h.id),
    ...doc.variables.filter((v) => v.metric === id).map((v) => v.id),
    ...doc.analyses
      .filter((a) => a.hypothesis === id || a.variables.includes(id) || a.conditions.includes(id))
      .map((a) => a.id),
    ...(doc.runMatrix.conditions.includes(id) || doc.runMatrix.datasets.includes(id) ? ['runMatrix'] : []),
  ];
}

function variable(doc: Draft, input: Variable): DraftError | Variable {
  const parsed = draftVariableSchema.safeParse({ ...input, id: 'v-1' });
  if (!parsed.success) return 'invalid_text';
  if (input.metric && !doc.metrics.some((m) => m.id === input.metric)) return 'unknown_metric';
  const { id: _id, ...value } = parsed.data;
  void _id;
  // Only what is measured has a metric (the plan: a dependent variable or a covariate).
  return value.role === 'dependent' || value.role === 'covariate' ? value : { ...value, metric: null };
}
function metric(input: Metric): DraftError | Metric {
  if (input.key.trim() && !/^[A-Za-z0-9_\-. /]{1,250}$/.test(input.key.trim())) return 'invalid_key';
  const parsed = draftMetricSchema.safeParse({ ...input, id: 'm-1' });
  if (!parsed.success) return 'invalid_text';
  const { id: _id, ...value } = parsed.data;
  void _id;
  return value;
}
function dataset(input: Dataset): DraftError | Dataset {
  if (input.sha256 !== null && !/^[0-9a-f]{64}$/.test(input.sha256)) return 'invalid_hash';
  const parsed = draftDatasetSchema.safeParse({ ...input, id: 'd-1' });
  if (!parsed.success) return 'invalid_text';
  const { id: _id, ...value } = parsed.data;
  void _id;
  return value;
}
function condition(input: Condition): DraftError | Condition {
  const parsed = draftConditionSchema.safeParse({ ...input, id: 'c-1' });
  if (!parsed.success) return 'invalid_text';
  const { id: _id, ...value } = parsed.data;
  void _id;
  return value;
}

export function addVariable(doc: Draft, input: Variable): DraftResult {
  const value = variable(doc, input);
  if (typeof value === 'string') return fail(value);
  return ok({
    ...doc,
    next: { ...doc.next, v: doc.next.v + 1 },
    variables: [...doc.variables, { ...value, id: `v-${doc.next.v}` }],
  });
}
export function editVariable(doc: Draft, id: string, input: Variable): DraftResult {
  const old = doc.variables.find((x) => x.id === id);
  if (!old) return fail('unknown_variable');
  const value = variable(doc, input);
  if (typeof value === 'string') return fail(value);
  const entry = { ...value, id };
  return same(old, entry)
    ? ok(doc)
    : ok({ ...doc, variables: doc.variables.map((x) => (x.id === id ? entry : x)) });
}
export function removeVariable(doc: Draft, id: string): DraftResult {
  if (!doc.variables.some((x) => x.id === id)) return fail('unknown_variable');
  if (users(doc, id).length) return fail('in_use');
  return ok({ ...doc, variables: doc.variables.filter((x) => x.id !== id) });
}
export function addMetric(doc: Draft, input: Metric): DraftResult {
  const value = metric(input);
  if (typeof value === 'string') return fail(value);
  return ok({
    ...doc,
    next: { ...doc.next, m: doc.next.m + 1 },
    metrics: [...doc.metrics, { ...value, id: `m-${doc.next.m}` }],
  });
}
export function editMetric(doc: Draft, id: string, input: Metric): DraftResult {
  const old = doc.metrics.find((x) => x.id === id);
  if (!old) return fail('unknown_metric');
  const value = metric(input);
  if (typeof value === 'string') return fail(value);
  const entry = { ...value, id };
  return same(old, entry)
    ? ok(doc)
    : ok({ ...doc, metrics: doc.metrics.map((x) => (x.id === id ? entry : x)) });
}
export function removeMetric(doc: Draft, id: string): DraftResult {
  if (!doc.metrics.some((x) => x.id === id)) return fail('unknown_metric');
  if (users(doc, id).length) return fail('in_use');
  return ok({ ...doc, metrics: doc.metrics.filter((x) => x.id !== id) });
}
export function addDataset(doc: Draft, input: Dataset): DraftResult {
  const value = dataset(input);
  if (typeof value === 'string') return fail(value);
  return ok({
    ...doc,
    next: { ...doc.next, d: doc.next.d + 1 },
    datasets: [...doc.datasets, { ...value, id: `d-${doc.next.d}` }],
  });
}
export function editDataset(doc: Draft, id: string, input: Dataset): DraftResult {
  const old = doc.datasets.find((x) => x.id === id);
  if (!old) return fail('unknown_dataset');
  const value = dataset(input);
  if (typeof value === 'string') return fail(value);
  const entry = { ...value, id };
  return same(old, entry)
    ? ok(doc)
    : ok({ ...doc, datasets: doc.datasets.map((x) => (x.id === id ? entry : x)) });
}
export function removeDataset(doc: Draft, id: string): DraftResult {
  if (!doc.datasets.some((x) => x.id === id)) return fail('unknown_dataset');
  if (users(doc, id).length) return fail('in_use');
  return ok({ ...doc, datasets: doc.datasets.filter((x) => x.id !== id) });
}
export function addCondition(doc: Draft, input: Condition): DraftResult {
  const value = condition(input);
  if (typeof value === 'string') return fail(value);
  return ok({
    ...doc,
    next: { ...doc.next, c: doc.next.c + 1 },
    conditions: [...doc.conditions, { ...value, id: `c-${doc.next.c}` }],
  });
}
export function editCondition(doc: Draft, id: string, input: Condition): DraftResult {
  const old = doc.conditions.find((x) => x.id === id);
  if (!old) return fail('unknown_condition');
  const value = condition(input);
  if (typeof value === 'string') return fail(value);
  const entry = { ...value, id };
  return same(old, entry)
    ? ok(doc)
    : ok({ ...doc, conditions: doc.conditions.map((x) => (x.id === id ? entry : x)) });
}
export function removeCondition(doc: Draft, id: string): DraftResult {
  if (!doc.conditions.some((x) => x.id === id)) return fail('unknown_condition');
  if (users(doc, id).length) return fail('in_use');
  return ok({ ...doc, conditions: doc.conditions.filter((x) => x.id !== id) });
}
export function setHypothesisVariables(
  doc: Draft,
  id: string,
  input: { independent: string[]; dependent: string[] },
): DraftResult {
  const old = doc.hypotheses.find((h) => h.id === id);
  if (!old) return fail('unknown_hypothesis');
  const value = { independent: [...new Set(input.independent)], dependent: [...new Set(input.dependent)] };
  for (const role of ['independent', 'dependent'] as const)
    for (const variableId of value[role]) {
      const v = doc.variables.find((item) => item.id === variableId);
      if (!v) return fail('unknown_variable');
      if (v.role !== role) return fail('wrong_role');
    }
  const entry = { ...old, ...value };
  return same(old, entry)
    ? ok(doc)
    : ok({ ...doc, hypotheses: doc.hypotheses.map((h) => (h.id === id ? entry : h)) });
}
export function metricFromBank(bank: BankMetric, release: string): Metric {
  const goals = {
    higher_better: 'maximize',
    lower_better: 'minimize',
    target_value: 'target',
    descriptive: null,
  } as const;
  return {
    name: bank.name,
    key: '',
    unit: bank.unit ?? '',
    goal: goals[bank.direction],
    aggregation: null,
    protocol: '',
    bank: { id: bank.id, release },
    protocolBank: null,
  };
}
export function datasetFromBank(bank: BankBenchmark, release: string): Dataset {
  return {
    name: bank.name,
    source: bank.url ?? '',
    version: null,
    split: null,
    sha256: null,
    benchmark: { id: bank.id, release },
  };
}
