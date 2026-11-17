import { bankBenchmarks, bankMetrics } from '../bank/readSnapshot';
import type { BankDoc } from '../bank/snapshot';
import type { ExperimentFact } from './experimentFacts';

export function normaliseName(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\p{P}\p{S}_]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

export function offerMatches(
  fact: ExperimentFact,
  bank: BankDoc | null,
): { id: string; name: string; how: 'name' | 'alias' }[] {
  const value = normaliseName(fact.value);
  if (!value || !bank) return [];
  if (fact.kind === 'metric')
    return bankMetrics(bank).flatMap<{ id: string; name: string; how: 'name' | 'alias' }>((entry) => {
      if (normaliseName(entry.name) === value)
        return [{ id: entry.id, name: entry.name, how: 'name' as const }];
      if (entry.aliases.some((alias) => normaliseName(alias) === value))
        return [{ id: entry.id, name: entry.name, how: 'alias' as const }];
      return [];
    });
  if (fact.kind === 'dataset')
    return bankBenchmarks(bank)
      .filter((entry) => normaliseName(entry.name) === value)
      .map(({ id, name }) => ({ id, name, how: 'name' as const }));
  return [];
}

export function resolveMatch(match: { id: string; release: string }, bank: BankDoc | null): string | null {
  if (!bank) return null;
  const ids = new Set(Object.values(bank.collections).flatMap((entries) => entries.map((entry) => entry.id)));
  const seen = new Set<string>();
  let id = match.id;
  for (let steps = 0; steps <= 10; steps++) {
    if (ids.has(id)) return id;
    if (steps === 10 || seen.has(id)) return null;
    seen.add(id);
    const next = Object.hasOwn(bank.aliases, id) ? bank.aliases[id] : undefined;
    if (!next) return null;
    id = next;
  }
  return null;
}

export function matchState(
  match: { id: string; release: string },
  bank: BankDoc | null,
): 'current' | 'other_release' | 'missing' {
  if (!bank) return 'missing';
  if (match.release !== bank.release) return 'other_release';
  return resolveMatch(match, bank) ? 'current' : 'missing';
}
