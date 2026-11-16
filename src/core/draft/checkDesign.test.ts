import { expect, it } from 'vitest';
import { readSnapshot, toBankDoc } from '../bank/readSnapshot';
import { snapshot } from '../bank/testSupport';
import { emptyDraft, type Draft } from './schema';
import { checkDesign } from './checkDesign';

const parsed = readSnapshot(snapshot);
if (!parsed.ok) throw Error();
const bank = toBankDoc(parsed.file, 'sha256:0123456789abcdef', 'test', '2026-01-01T00:00:00Z');
const draft: Draft = {
  ...emptyDraft(),
  design: {
    name: 'Test benchmark',
    assignment: null,
    bank: { id: 'rd.test-benchmark', release: bank.release },
  },
  hypotheses: [
    {
      id: 'h-1',
      statement: 'Test',
      kind: 'directional',
      question: null,
      claim: 'ct.causal',
      independent: [],
      dependent: [],
    },
    {
      id: 'h-2',
      statement: 'Test',
      kind: 'directional',
      question: null,
      claim: null,
      independent: [],
      dependent: [],
    },
  ],
  threats: [
    { id: 't-1', name: 'Test', mitigation: '', bank: { id: 'vt.test-confound', release: bank.release } },
  ],
};
it('DS-01 DS-02 DS-03 DS-04 orders warnings', () => {
  expect(checkDesign(draft, bank).map((x) => x.rule)).toEqual(['DS-01', 'DS-02', 'DS-03', 'DS-04']);
});
it('DS-05 reports missing snapshots, entries and releases and suppresses DS-01 without a design', () => {
  const none = checkDesign(draft, null);
  expect(none.some((x) => x.rule === 'DS-01')).toBe(false);
  expect(none.filter((x) => x.rule === 'DS-05')).toHaveLength(3);
  const changed: Draft = {
    ...draft,
    design: { ...draft.design!, bank: { id: 'rd.missing', release: bank.release } },
  };
  expect(checkDesign(changed, bank)).toContainEqual(
    expect.objectContaining({ rule: 'DS-05', subject: 'design', reason: 'missing' }),
  );
  expect(checkDesign(changed, bank).some((x) => x.rule === 'DS-01')).toBe(false);
  changed.design!.bank!.release = 'sha256:aaaaaaaaaaaaaaaa';
  expect(checkDesign(changed, bank)).toContainEqual(
    expect.objectContaining({ rule: 'DS-05', reason: 'other_release' }),
  );
});
