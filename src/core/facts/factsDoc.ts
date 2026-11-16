import { z } from 'zod';
import type { PaperModelView } from '../papers/paperModel';
import { resolveAnchors } from './anchors';
import { readExperimentFacts, type ExperimentFactsView } from './experimentFacts';

const sourceSchema = z.strictObject({
  paperlabId: z.string(),
  etag: z.string(),
  fetchedBy: z.string(),
  fetchedAt: z.iso.datetime(),
});
const decisionSchema = z
  .strictObject({
    decision: z.enum(['use', 'exclude']),
    reason: z.string().nullable(),
    by: z.string(),
    at: z.iso.datetime(),
  })
  .refine((entry) =>
    entry.decision === 'exclude'
      ? entry.reason !== null && entry.reason.trim().length > 0
      : entry.reason === null,
  );
const factsSchema = z.custom<ExperimentFactsView>((value) => readExperimentFacts(value).ok);
export const factsDocSchema = z.strictObject({
  schemaVersion: z.literal(1),
  paperId: z.string().regex(/^p-[0-9a-f]{12}$/),
  source: sourceSchema,
  facts: factsSchema,
  decisions: z.record(z.string(), decisionSchema),
});
export type FactsDoc = z.infer<typeof factsDocSchema>;
export type FactsSource = z.infer<typeof sourceSchema>;
type Result =
  { ok: true; doc: FactsDoc } | { ok: false; error: 'unknown_fact' | 'reason_required' | 'not_anchored' };

export function decide(
  doc: FactsDoc,
  factIds: string[],
  decision: 'use' | 'exclude',
  reason: string | null,
  who: string,
  at: string,
  model: PaperModelView,
): Result {
  const selected = factIds.map((id) => doc.facts.facts.find((fact) => fact.id === id));
  if (selected.some((fact) => !fact)) return { ok: false, error: 'unknown_fact' };
  const cleanReason = decision === 'exclude' ? reason?.trim() || null : null;
  if (decision === 'exclude' && !cleanReason) return { ok: false, error: 'reason_required' };
  if (decision === 'use' && selected.some((fact) => fact && !resolveAnchors(fact, model).anchored))
    return { ok: false, error: 'not_anchored' };
  const decisions = { ...doc.decisions };
  for (const id of factIds)
    Object.defineProperty(decisions, id, {
      value: { decision, reason: cleanReason, by: who, at },
      enumerable: true,
      configurable: true,
      writable: true,
    });
  return { ok: true, doc: { ...doc, decisions } };
}
export function clearDecision(doc: FactsDoc, factIds: string[]): Result {
  if (factIds.some((id) => !doc.facts.facts.some((fact) => fact.id === id)))
    return { ok: false, error: 'unknown_fact' };
  const decisions = { ...doc.decisions };
  for (const id of factIds) delete decisions[id];
  return { ok: true, doc: { ...doc, decisions } };
}
export function replaceFacts(
  doc: FactsDoc,
  facts: ExperimentFactsView,
  source: FactsSource,
): { ok: true; doc: FactsDoc; dropped: string[] } {
  const ids = new Set(facts.facts.map((fact) => fact.id));
  const dropped = Object.keys(doc.decisions).filter((id) => !ids.has(id));
  const decisions = Object.fromEntries(Object.entries(doc.decisions).filter(([id]) => ids.has(id)));
  return { ok: true, doc: { ...doc, facts, source, decisions }, dropped };
}
