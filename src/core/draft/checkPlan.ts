import { SRD_P0_METHODS } from '../plan/schema';
import { TWO_SAMPLE } from '../plan/validatePlan';
import type { Draft } from './schema';

export type PlanFlag =
  | { rule: 'AN-01' | 'AN-02' | 'AN-03' | 'RM-03'; subject: string; level: 'warning' }
  | { rule: 'AN-04'; subject: string; level: 'warning'; method: string; count: number }
  | { rule: 'AN-05'; subject: string; level: 'warning'; condition: string }
  | { rule: 'AN-06' | 'RM-02'; subject: string; level: 'warning'; id: string }
  | { rule: 'AN-07'; subject: string; level: 'note'; method: string }
  | { rule: 'RM-01'; subject: string; level: 'warning'; missing: string[] };

export function checkPlan(draft: Draft): PlanFlag[] {
  const flags: PlanFlag[] = [];
  for (const h of draft.hypotheses)
    if (h.kind !== 'exploratory' && !draft.analyses.some((a) => a.hypothesis === h.id))
      flags.push({ rule: 'AN-01', subject: h.id, level: 'warning' });
  for (const a of draft.analyses) {
    const subject = a.id;
    if (!a.method) flags.push({ rule: 'AN-02', subject, level: 'warning' });
    if (!a.variables.length) flags.push({ rule: 'AN-03', subject, level: 'warning' });
    if (a.method && TWO_SAMPLE.includes(a.method) && a.conditions.length !== 2)
      flags.push({ rule: 'AN-04', subject, level: 'warning', method: a.method, count: a.conditions.length });
    for (const condition of a.conditions)
      if (!draft.runMatrix.conditions.includes(condition))
        flags.push({ rule: 'AN-05', subject, level: 'warning', condition });
    const missing = [
      ...(a.hypothesis && !draft.hypotheses.some((h) => h.id === a.hypothesis) ? [a.hypothesis] : []),
      ...a.variables.filter((id) => !draft.variables.some((v) => v.id === id)),
      ...a.conditions.filter((id) => !draft.conditions.some((c) => c.id === id)),
    ];
    for (const id of missing) flags.push({ rule: 'AN-06', subject, level: 'warning', id });
    if (a.method && !(SRD_P0_METHODS as readonly string[]).includes(a.method))
      flags.push({ rule: 'AN-07', subject, level: 'note', method: a.method });
  }
  const m = draft.runMatrix;
  const missing = (
    ['mlflowExperiment', 'conditions', 'datasets', 'seeds', 'sampleSizeJustification'] as const
  ).filter((key) => !m[key].length);
  if (missing.length) flags.push({ rule: 'RM-01', subject: 'runMatrix', level: 'warning', missing });
  for (const id of [
    ...m.conditions.filter((id) => !draft.conditions.some((c) => c.id === id)),
    ...m.datasets.filter((id) => !draft.datasets.some((d) => d.id === id)),
  ])
    flags.push({ rule: 'RM-02', subject: 'runMatrix', level: 'warning', id });
  if (m.conditions.length > 1 && !draft.conditions.some((c) => c.baseline && m.conditions.includes(c.id)))
    flags.push({ rule: 'RM-03', subject: 'runMatrix', level: 'warning' });
  return flags.sort(
    (a, b) => a.rule.localeCompare(b.rule) || a.subject.localeCompare(b.subject, 'en', { numeric: true }),
  );
}
