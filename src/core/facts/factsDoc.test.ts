import example from '../../../schemas/vendor/experiment-facts-v1.example.json';
import type { PaperModelView } from '../papers/paperModel';
import type { ExperimentFactsView } from './experimentFacts';
import { clearDecision, decide, factsDocSchema, replaceFacts, type FactsDoc } from './factsDoc';

const facts = structuredClone(example) as ExperimentFactsView;
const source = {
  paperlabId: 'paperlab-1',
  etag: 'etag',
  fetchedBy: 'person',
  fetchedAt: '2026-01-01T00:00:00Z',
};
const doc: FactsDoc = { schemaVersion: 1, paperId: 'p-012345abcdef', source, facts, decisions: {} };
const model = {
  sentences: [{ key: facts.facts[0]!.sentenceKeys[0]!, text: 'Invented', page: null }],
  document: { blocks: [] },
} as unknown as PaperModelView;
const at = '2026-01-02T00:00:00Z';
it('FR-303 validates a strict stored document and reason equivalence', () => {
  expect(factsDocSchema.safeParse(doc).success).toBe(true);
  expect(factsDocSchema.safeParse({ ...doc, extra: 1 }).success).toBe(false);
  expect(factsDocSchema.safeParse({ ...doc, paperId: 'invalid' }).success).toBe(false);
  for (const decision of [
    { decision: 'exclude', reason: ' ' },
    { decision: 'use', reason: 'why' },
  ]) {
    expect(
      factsDocSchema.safeParse({ ...doc, decisions: { f: { ...decision, by: 'person', at } } }).success,
    ).toBe(false);
  }
  expect(factsDocSchema.safeParse({ ...doc, source: { ...source, fetchedAt: 'yesterday' } }).success).toBe(
    false,
  );
  expect(factsDocSchema.safeParse({ ...doc, facts: {} }).success).toBe(false);
});
it('FR-302 and FR-303 reject a batch atomically for unknown, unanchored, or unexplained facts', () => {
  expect(decide(doc, ['fact-1', 'unknown'], 'use', null, 'person', at, model)).toEqual({
    ok: false,
    error: 'unknown_fact',
  });
  expect(decide(doc, ['fact-1', 'fact-2'], 'use', null, 'person', at, model)).toEqual({
    ok: false,
    error: 'not_anchored',
  });
  expect(decide(doc, ['fact-1'], 'exclude', '  ', 'person', at, model)).toEqual({
    ok: false,
    error: 'reason_required',
  });
  expect(clearDecision(doc, ['unknown'])).toEqual({ ok: false, error: 'unknown_fact' });
  expect(doc.decisions).toEqual({});
});
it('FR-303 preserves facts while deciding, clearing, and replacing; retains only surviving decisions', () => {
  const first = decide(doc, ['fact-1'], 'use', 'ignored', 'person', at, model);
  expect(first.ok).toBe(true);
  if (!first.ok) return;
  expect(first.doc.facts).toEqual(facts);
  expect(first.doc.decisions['fact-1']).toEqual({ decision: 'use', reason: null, by: 'person', at });
  const second = decide(first.doc, ['fact-2', 'fact-3'], 'exclude', ' reason ', 'person', at, model);
  expect(second.ok).toBe(true);
  if (!second.ok) return;
  expect(second.doc.facts).toEqual(facts);
  expect(second.doc.decisions['fact-2']).toEqual({ decision: 'exclude', reason: 'reason', by: 'person', at });
  const cleared = clearDecision(second.doc, ['fact-3']);
  expect(cleared.ok).toBe(true);
  if (!cleared.ok) return;
  expect(cleared.doc.facts).toEqual(facts);
  expect(cleared.doc.decisions['fact-3']).toBeUndefined();
  const newFacts = { ...facts, facts: [facts.facts[0]!] };
  const replacement = replaceFacts(cleared.doc, newFacts, { ...source, etag: 'new' });
  expect(replacement.doc.facts).toEqual(newFacts);
  expect(replacement.doc.source.etag).toBe('new');
  expect(replacement.dropped).toEqual(['fact-2']);
  expect(Object.keys(replacement.doc.decisions)).toEqual(['fact-1']);
});
