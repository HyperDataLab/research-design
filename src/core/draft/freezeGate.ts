import type { PapersDoc } from '../papers/papers';
import type { ExperimentPlan } from '../plan/schema';
import { validatePlan, type PlanIssue } from '../plan/validatePlan';
import type { Draft } from './schema';
import { draftToPlan } from './toPlan';

export type Missing = {
  code:
    | 'no_hypotheses'
    | 'no_variables'
    | 'no_metrics'
    | 'no_datasets'
    | 'no_conditions'
    | 'hypothesis_without_dependent'
    | 'metric_incomplete'
    | 'dataset_without_source'
    | 'analysis_without_method'
    | 'analysis_without_variables'
    | 'grid_incomplete'
    | 'design_without_assignment'
    | 'threat_without_mitigation'
    | 'other';
  subject?: string;
  fields?: string[];
  text?: string;
};
export type PlanMeta = Parameters<typeof draftToPlan>[1];
export type Gate =
  | { state: 'not_a_plan'; missing: Missing[] }
  | { state: 'plan'; plan: ExperimentPlan; issues: PlanIssue[]; blocked: boolean; unchanged: boolean };

export function samePlanContent(a: ExperimentPlan, b: ExperimentPlan): boolean {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .sort(([x], [y]) => x.localeCompare(y))
          .map(([k, v]) => [k, canonical(v)]),
      );
    return value;
  };
  const content = (plan: ExperimentPlan) => {
    const { planVersion, frozenAt, frozenBy, deviation, generator, ...rest } = plan;
    void planVersion;
    void frozenAt;
    void frozenBy;
    void deviation;
    void generator;
    return JSON.stringify(canonical(rest));
  };
  return content(a) === content(b);
}
export const nextVersion = (versions: number[]) => Math.max(0, ...versions) + 1;

export function freezeGate(
  draft: Draft,
  meta: PlanMeta,
  papers: PapersDoc | undefined,
  previous: ExperimentPlan | null,
): Gate {
  const result = draftToPlan(draft, meta, papers);
  if (result.ok) {
    const issues = validatePlan(result.plan);
    return {
      state: 'plan',
      plan: result.plan,
      issues,
      blocked: issues.some((i) => i.level === 'blocking'),
      unchanged: previous !== null && samePlanContent(result.plan, previous),
    };
  }
  const missing: Missing[] = [];
  const explained: string[] = [];
  const add = (item: Missing, ...paths: string[]) => {
    missing.push(item);
    explained.push(...paths);
  };
  for (const [field, code] of [
    ['hypotheses', 'no_hypotheses'],
    ['variables', 'no_variables'],
    ['metrics', 'no_metrics'],
    ['datasets', 'no_datasets'],
    ['conditions', 'no_conditions'],
  ] as const)
    if (!draft[field].length) add({ code }, `${field}:`);
  draft.hypotheses.forEach((h, i) => {
    if (!h.dependent.length)
      add({ code: 'hypothesis_without_dependent', subject: h.id }, `hypotheses.${i}.dependent:`);
  });
  draft.metrics.forEach((m, i) => {
    const fields = (['key', 'unit', 'goal', 'aggregation', 'protocol'] as const).filter((f) => !m[f]);
    if (fields.length)
      add({ code: 'metric_incomplete', subject: m.id, fields }, ...fields.map((f) => `metrics.${i}.${f}:`));
  });
  draft.datasets.forEach((d, i) => {
    if (!d.source) add({ code: 'dataset_without_source', subject: d.id }, `datasets.${i}.source:`);
  });
  draft.analyses.forEach((a, i) => {
    if (!a.method) add({ code: 'analysis_without_method', subject: a.id }, `analyses.${i}.method:`);
    if (!a.variables.length)
      add({ code: 'analysis_without_variables', subject: a.id }, `analyses.${i}.variables:`);
  });
  const grid = draft.runMatrix;
  const fields = (
    ['mlflowExperiment', 'conditions', 'datasets', 'seeds', 'sampleSizeJustification'] as const
  ).filter((f) => !grid[f].length);
  if (fields.length)
    add(
      { code: 'grid_incomplete', fields },
      ...fields.map((f) => `runMatrix.${f}:`),
      'runMatrix.expectedRuns:',
    );
  if (draft.design && !draft.design.assignment)
    add({ code: 'design_without_assignment' }, 'context.design.assignment:');
  draft.threats.forEach((t, i) => {
    if (!t.mitigation)
      add({ code: 'threat_without_mitigation', subject: t.id }, `context.threats.${i}.mitigation:`);
  });
  for (const issue of result.issues)
    if (!explained.some((path) => issue.startsWith(path))) missing.push({ code: 'other', text: issue });
  if (!missing.length) missing.push({ code: 'other', text: result.issues.join('; ') });
  return { state: 'not_a_plan', missing };
}
