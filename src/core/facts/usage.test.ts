import { bankDocSchema } from '../bank/snapshot';
import type { Paper } from '../papers/papers';
import type { ExperimentFact, ExperimentFactsView } from './experimentFacts';
import type { FactsDoc } from './factsDoc';
import { usage } from './usage';

const at = '2026-01-01T00:00:00Z';
const bank = bankDocSchema.parse({
  schemaVersion: 1,
  release: '2026.01.1',
  source: '',
  importedBy: '',
  importedAt: at,
  aliases: { 'met.old': 'met.alpha' },
  collections: {
    designs: [],
    threats: [],
    'claim-types': [],
    metrics: [{ id: 'met.alpha', name: 'Alpha Score', family: '', definition: '', direction: 'descriptive' }],
    benchmarks: [{ id: 'bm.beta', name: 'Beta Set', task: '' }],
  },
});
const paper = (id: string) => ({ id, title: id }) as Paper;
const fact = (id: string, kind: ExperimentFact['kind'], value: string) =>
  ({ id, kind, value }) as ExperimentFact;
const doc = (
  facts: ExperimentFact[],
  used: string[],
  matches: NonNullable<FactsDoc['matches']> = {},
): FactsDoc => ({
  schemaVersion: 1,
  paperId: 'p-000000000001',
  source: { paperlabId: '', etag: '', fetchedBy: '', fetchedAt: at },
  facts: { facts } as ExperimentFactsView,
  decisions: Object.fromEntries(used.map((id) => [id, { decision: 'use', reason: null, by: '', at }])),
  matches,
});
it('FR-305 counts distinct passed papers and groups confirmed aliases or normalised values', () => {
  const a = doc(
    [
      fact('a', 'metric', 'Alias'),
      fact('b', 'metric', 'Another alias'),
      fact('c', 'baseline', 'First-System'),
      fact('d', 'dataset', 'Beta Set'),
      fact('e', 'metric', 'Excluded'),
    ],
    ['a', 'b', 'c', 'd'],
    {
      a: { bank: { id: 'met.old', release: 'old' }, by: '', at },
      b: { bank: { id: 'met.alpha', release: bank.release }, by: '', at },
      d: { bank: { id: 'bm.beta', release: bank.release }, by: '', at },
    },
  );
  const b = doc(
    [
      fact('a', 'metric', 'Alias again'),
      fact('c', 'baseline', 'first system'),
      fact('z', 'baseline', 'Zeta'),
      fact('q', 'baseline', 'Alpha'),
    ],
    ['a', 'c', 'z', 'q'],
    { a: { bank: { id: 'met.alpha', release: bank.release }, by: '', at } },
  );
  const result = usage([paper('a'), paper('b')], { a, b, ignored: a }, bank);
  expect(result.metric).toEqual([
    { key: 'met.alpha', label: 'Alpha Score', bankId: 'met.alpha', papers: ['a', 'b'] },
  ]);
  expect(result.dataset).toEqual([{ key: 'bm.beta', label: 'Beta Set', bankId: 'bm.beta', papers: ['a'] }]);
  expect(result.baseline.map((row) => row.label)).toEqual(['First-System', 'Alpha', 'Zeta']);
  expect(result.baseline[0]?.papers).toEqual(['a', 'b']);
  expect(usage([paper('a')], { a }, null).metric.map((row) => row.key)).toEqual(['alias', 'another alias']);
});
