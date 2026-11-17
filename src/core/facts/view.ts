import type { Paper } from '../papers/papers';
import type { FactKind } from './experimentFacts';
import type { FactsDoc } from './factsDoc';

export const FACT_KINDS: readonly FactKind[] = [
  'task',
  'dataset',
  'baseline',
  'method',
  'metric',
  'design',
  'sample',
  'result',
];
export function comparisonRows(papers: Paper[], factsByPaperId: Record<string, FactsDoc | undefined>) {
  return papers.map((paper) => {
    const doc = factsByPaperId[paper.id];
    return {
      paper,
      cells: FACT_KINDS.map((kind) => ({
        kind,
        items: (doc?.facts.facts ?? [])
          .filter((fact) => fact.kind === kind)
          .map((fact) => ({
            fact,
            status: fact.status,
            decision: Object.hasOwn(doc?.decisions ?? {}, fact.id) ? doc!.decisions[fact.id]! : null,
          })),
      })),
    };
  });
}
export function staleModel(doc: FactsDoc, heldModelEtag: string | null): boolean {
  const normalise = (etag: string) => etag.replace(/^W\//, '').replace(/^"|"$/g, '');
  return heldModelEtag !== null && normalise(heldModelEtag) !== normalise(doc.facts.modelEtag);
}
