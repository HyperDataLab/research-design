import { bankBenchmarks, bankMetrics } from '../bank/readSnapshot';
import type { BankDoc } from '../bank/snapshot';
import type { Paper } from '../papers/papers';
import type { FactsDoc } from './factsDoc';
import { normaliseName, resolveMatch } from './match';

export type Row = { key: string; label: string; bankId: string | null; papers: string[] };
export function usage(
  papers: Paper[],
  factsByPaperId: Record<string, FactsDoc | undefined>,
  bank: BankDoc | null,
): { baseline: Row[]; dataset: Row[]; metric: Row[] } {
  const groups = {
    baseline: new Map<string, Row>(),
    dataset: new Map<string, Row>(),
    metric: new Map<string, Row>(),
  };
  const entries = [...bankMetrics(bank), ...bankBenchmarks(bank)];
  for (const paper of papers) {
    const doc = factsByPaperId[paper.id];
    if (!doc) continue;
    for (const fact of doc.facts.facts) {
      if (fact.kind !== 'baseline' && fact.kind !== 'dataset' && fact.kind !== 'metric') continue;
      if (doc.decisions[fact.id]?.decision !== 'use') continue;
      const match = doc.matches?.[fact.id]?.bank;
      const bankId = match ? resolveMatch(match, bank) : null;
      const key = bankId ?? normaliseName(fact.value);
      const group = groups[fact.kind];
      let row = group.get(key);
      if (!row) {
        row = {
          key,
          label: bankId ? (entries.find((entry) => entry.id === bankId)?.name ?? fact.value) : fact.value,
          bankId,
          papers: [],
        };
        group.set(key, row);
      }
      if (!row.papers.includes(paper.id)) row.papers.push(paper.id);
    }
  }
  const rows = (map: Map<string, Row>) =>
    [...map.values()].sort((a, b) => b.papers.length - a.papers.length || a.label.localeCompare(b.label));
  return { baseline: rows(groups.baseline), dataset: rows(groups.dataset), metric: rows(groups.metric) };
}
