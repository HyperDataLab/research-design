import { RUN_TAGS } from '../plan/schema';
import type { Draft } from './schema';

export type ChainFlag =
  | { rule: 'CH-01' | 'CH-06' | 'CH-07' | 'CH-08'; subject: string }
  | { rule: 'CH-02'; subject: string; hypothesis: string }
  | { rule: 'CH-03'; subject: string; variable: string; which: 'missing' | 'wrong_role' }
  | { rule: 'CH-04'; subject: string; missing: string[] }
  | { rule: 'CH-05'; subject: string; reason: 'duplicate' | 'reserved' };

export function checkChain(draft: Draft): ChainFlag[] {
  const flags: ChainFlag[] = [];
  for (const h of draft.hypotheses) {
    if (!h.dependent.length) flags.push({ rule: 'CH-01', subject: h.id });
    for (const role of ['independent', 'dependent'] as const)
      for (const id of h[role]) {
        const v = draft.variables.find((item) => item.id === id);
        if (!v || v.role !== role)
          flags.push({ rule: 'CH-03', subject: h.id, variable: id, which: v ? 'wrong_role' : 'missing' });
        if (role === 'dependent' && v && v.role === 'dependent' && !v.metric)
          flags.push({ rule: 'CH-02', subject: id, hypothesis: h.id });
      }
  }
  for (const m of draft.metrics) {
    const missing = (['key', 'unit', 'goal', 'aggregation', 'protocol'] as const).filter(
      (field) => !m[field],
    );
    if (missing.length) flags.push({ rule: 'CH-04', subject: m.id, missing });
    if (m.key && draft.metrics.filter((other) => other.key === m.key).length > 1)
      flags.push({ rule: 'CH-05', subject: m.id, reason: 'duplicate' });
    if ((Object.values(RUN_TAGS) as string[]).includes(m.key))
      flags.push({ rule: 'CH-05', subject: m.id, reason: 'reserved' });
  }
  for (const v of draft.variables) {
    if (v.role === 'independent' && v.levels.length < 2) flags.push({ rule: 'CH-06', subject: v.id });
    if (v.metric && !draft.metrics.some((m) => m.id === v.metric))
      flags.push({ rule: 'CH-08', subject: v.id });
  }
  for (const d of draft.datasets) if (!d.source) flags.push({ rule: 'CH-07', subject: d.id });
  return flags.sort(
    (a, b) => a.rule.localeCompare(b.rule) || a.subject.localeCompare(b.subject, 'en', { numeric: true }),
  );
}

export function chainOf(draft: Draft, hypothesisId: string) {
  const hypothesis = draft.hypotheses.find((h) => h.id === hypothesisId) ?? null;
  const dependent = (hypothesis?.dependent ?? []).map((id) => {
    const variable = draft.variables.find((v) => v.id === id) ?? null;
    const metric = draft.metrics.find((m) => m.id === variable?.metric) ?? null;
    return { variable, metric };
  });
  const independent = (hypothesis?.independent ?? []).flatMap((id) => {
    const variable = draft.variables.find((v) => v.id === id);
    return variable ? [variable] : [];
  });
  return { hypothesis, dependent, independent };
}
