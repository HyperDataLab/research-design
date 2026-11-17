import { bankDocSchema } from '../bank/snapshot';
import type { ExperimentFact } from './experimentFacts';
import { matchState, normaliseName, offerMatches, resolveMatch } from './match';

const bank = bankDocSchema.parse({
  schemaVersion: 1,
  release: '2026.01.1',
  source: '',
  importedBy: 'person',
  importedAt: '2026-01-01T00:00:00Z',
  aliases: { 'met.old': 'met.middle', 'met.middle': 'met.alpha', 'met.loop': 'met.loop' },
  collections: {
    designs: [],
    threats: [],
    'claim-types': [],
    metrics: [
      {
        id: 'met.alpha',
        name: 'Alpha Score',
        aliases: ['First Score'],
        family: '',
        definition: '',
        direction: 'descriptive',
      },
    ],
    benchmarks: [{ id: 'bm.beta', name: 'Beta Set', task: '' }],
  },
});
const fact = (kind: ExperimentFact['kind'], value: string) => ({ kind, value }) as ExperimentFact;

it('FR-304 normalises case, whitespace and punctuation without fuzzy or empty matches', () => {
  expect(normaliseName(' F1-score ')).toBe(normaliseName('f1  Score.'));
  expect(normaliseName('F1_score')).toBe('f1 score');
  expect(offerMatches(fact('metric', '...'), bank)).toEqual([]);
  expect(offerMatches(fact('metric', 'alpha'), bank)).toEqual([]);
  expect(offerMatches(fact('metric', 'alpha score'), null)).toEqual([]);
});
it('FR-304 offers names and metric aliases only for their respective kinds', () => {
  expect(offerMatches(fact('metric', 'Alpha-score'), bank)).toEqual([
    { id: 'met.alpha', name: 'Alpha Score', how: 'name' },
  ]);
  expect(offerMatches(fact('metric', 'First Score'), bank)[0]?.how).toBe('alias');
  expect(offerMatches(fact('dataset', 'Beta Set'), bank)[0]?.id).toBe('bm.beta');
  expect(offerMatches(fact('dataset', 'First Score'), bank)).toEqual([]);
  expect(offerMatches(fact('baseline', 'Alpha Score'), bank)).toEqual([]);
});
it('FR-304 resolves aliases within ten hops, handles cycles and reports release state', () => {
  const match = { id: 'met.old', release: bank.release };
  expect(resolveMatch(match, bank)).toBe('met.alpha');
  expect(matchState(match, bank)).toBe('current');
  expect(matchState({ ...match, release: 'older' }, bank)).toBe('other_release');
  expect(matchState({ ...match, id: 'met.missing' }, bank)).toBe('missing');
  expect(resolveMatch({ ...match, id: 'met.loop' }, bank)).toBeNull();
  expect(resolveMatch(match, null)).toBeNull();
  const aliases = Object.fromEntries(
    Array.from({ length: 11 }, (_, i) => [`met.${i}`, i === 10 ? 'met.alpha' : `met.${i + 1}`]),
  );
  expect(resolveMatch({ ...match, id: 'met.0' }, { ...bank, aliases })).toBeNull();
  expect(resolveMatch({ ...match, id: 'met.1' }, { ...bank, aliases })).toBe('met.alpha');
});
