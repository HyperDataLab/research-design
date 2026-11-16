import type { PaperModelView } from '../papers/paperModel';
import type { ExperimentFact } from './experimentFacts';

export function resolveAnchors(fact: ExperimentFact, model: PaperModelView) {
  const sentences = fact.sentenceKeys.map((key) => {
    const sentence = model.sentences.find((entry) => entry.key === key);
    return sentence ? { key, found: true, text: sentence.text, page: sentence.page } : { key, found: false };
  });
  const cell = fact.tableCell;
  const block =
    cell && model.document.blocks.find((entry) => entry.id === cell.blockId && entry.kind === 'table');
  const tableCell = cell && {
    found: !!block,
    ...(block ? { blockText: block.text, page: block.page } : {}),
    row: cell.row,
    column: cell.column,
    rowHeader: cell.rowHeader,
    columnHeader: cell.columnHeader,
  };
  return { sentences, tableCell, anchored: sentences.some((entry) => entry.found) || !!block };
}
