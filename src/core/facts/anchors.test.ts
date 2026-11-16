import facts from '../../../schemas/vendor/experiment-facts-v1.example.json';
import type { PaperModelView } from '../papers/paperModel';
import type { ExperimentFact } from './experimentFacts';
import { resolveAnchors } from './anchors';

const fact = structuredClone(facts.facts[0]!) as ExperimentFact;
const model = {
  sentences: [{ key: fact.sentenceKeys[0]!, text: 'Invented sentence', page: 2 }],
  document: { blocks: [{ id: 't1', kind: 'table', text: 'Invented table', page: 3 }] },
} as PaperModelView;
it('FR-302 resolves sentence and table anchors with their locations', () => {
  expect(resolveAnchors(fact, model)).toEqual({
    sentences: [{ key: fact.sentenceKeys[0], found: true, text: 'Invented sentence', page: 2 }],
    tableCell: {
      found: true,
      blockText: 'Invented table',
      page: 3,
      row: 0,
      column: 1,
      rowHeader: null,
      columnHeader: null,
    },
    anchored: true,
  });
  expect(resolveAnchors({ ...fact, tableCell: null }, model).anchored).toBe(true);
  expect(resolveAnchors({ ...fact, sentenceKeys: [] }, model).anchored).toBe(true);
});
it('FR-302 marks missing keys and non-table blocks as missing', () => {
  const result = resolveAnchors(
    { ...fact, sentenceKeys: ['missing'] },
    { ...model, document: { ...model.document, blocks: [{ ...model.document.blocks[0]!, kind: 'text' }] } },
  );
  expect(result).toEqual({
    sentences: [{ key: 'missing', found: false }],
    tableCell: { found: false, row: 0, column: 1, rowHeader: null, columnHeader: null },
    anchored: false,
  });
  expect(resolveAnchors({ ...fact, tableCell: null, sentenceKeys: ['missing'] }, model).tableCell).toBeNull();
});
