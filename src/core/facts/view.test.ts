import example from '../../../schemas/vendor/experiment-facts-v1.example.json';
import type { Paper } from '../papers/papers';
import type { ExperimentFactsView } from './experimentFacts';
import type { FactsDoc } from './factsDoc';
import { comparisonRows, staleModel } from './view';

const paper = { id: 'p-012345abcdef' } as Paper;
const facts = structuredClone(example) as ExperimentFactsView;
const doc: FactsDoc = {
  schemaVersion: 1,
  paperId: paper.id,
  source: { paperlabId: 'p', etag: 'e', fetchedBy: 'person', fetchedAt: '2026-01-01T00:00:00Z' },
  facts,
  decisions: { 'fact-1': { decision: 'use', reason: null, by: 'person', at: '2026-01-01T00:00:00Z' } },
};
it('FR-303 groups each paper by the fixed kind order, retaining status, source fact and decision', () => {
  const rows = comparisonRows([paper, { ...paper, id: 'p-aaaaaaaaaaaa' }], { [paper.id]: doc });
  expect(rows[0]!.cells.map((cell) => cell.kind)).toEqual([
    'task',
    'dataset',
    'baseline',
    'method',
    'metric',
    'design',
    'sample',
    'result',
  ]);
  expect(rows[0]!.cells[4]!.items).toEqual([
    { fact: facts.facts[0], status: 'candidate', decision: doc.decisions['fact-1'] },
  ]);
  expect(rows[0]!.cells[2]!.items[0]!.decision).toBeNull();
  expect(rows[1]!.cells.every((cell) => cell.items.length === 0)).toBe(true);
});
it('FR-301 reports staleness only for a known different model etag', () => {
  expect(staleModel(doc, null)).toBe(false);
  expect(staleModel(doc, facts.modelEtag)).toBe(false);
  expect(staleModel(doc, `"${facts.modelEtag}"`)).toBe(false);
  expect(staleModel(doc, `W/"${facts.modelEtag}"`)).toBe(false);
  expect(staleModel(doc, 'different')).toBe(true);
});
