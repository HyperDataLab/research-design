import { describe, expect, it } from 'vitest';
import { addPaper, decide, emptyPapersDoc } from '@/core/papers/papers';
import { counts, filterPapers, logSentences } from './view';
const at = '2026-01-01T00:00:00Z';
const input = { title: 'Synthetic', authors: [], year: null, venue: null, doi: null };
describe('corpus view', () => {
  it('CO-01 counts and filters decisions', () => {
    const added = addPaper(emptyPapersDoc(), input, 'a', at, 'p-000000000001');
    if (!added.ok) throw Error();
    const changed = decide(added.doc, 'p-000000000001', 'excluded', 'reason', 'a', at);
    if (!changed.ok) throw Error();
    expect(counts(changed.doc.papers)).toEqual({ all: 1, undecided: 0, included: 0, excluded: 1 });
    expect(filterPapers(changed.doc.papers, 'excluded')).toHaveLength(1);
    expect(filterPapers(changed.doc.papers, 'included')).toHaveLength(0);
  });
  it('CO-02 renders every action newest first', () => {
    const added = addPaper(emptyPapersDoc(), input, 'a', at, 'p-000000000001');
    if (!added.ok) throw Error();
    const actions = ['added', 'included', 'excluded', 'undecided', 'model_imported'] as const;
    const log = actions.map((action) => ({
      at,
      by: 'a',
      paperId: 'p-000000000001',
      action,
      reason: action === 'excluded' ? 'reason' : null,
    }));
    const lines = logSentences({ ...added.doc, log });
    expect(lines.map((line) => line.split(' «')[0])).toEqual([
      'a đã nhập paper model cho',
      'a đã bỏ quyết định',
      'a đã loại',
      'a đã chọn',
      'a đã thêm',
    ]);
    expect(lines[2]).toContain('«Synthetic»: reason');
  });
});
