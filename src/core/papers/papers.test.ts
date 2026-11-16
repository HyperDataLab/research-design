import { describe, expect, it } from 'vitest';
import example from '../../../schemas/vendor/paper-model-v1.example.json';
import { readPaperModel } from './paperModel';
import {
  addPaper,
  attachModel,
  decide,
  emptyPapersDoc,
  matchPaper,
  newPaperId,
  normaliseDoi,
  paperFromModel,
  papersDocSchema,
} from './papers';

const at = '2025-01-01T00:00:00Z';
const input = { title: ' A ', authors: ['A'], year: 2020, venue: null, doi: 'DOI:10.1234/ABC' };
const id = newPaperId(new Uint8Array([1, 2, 3, 4, 5, 6]));
function added() {
  const result = addPaper(emptyPapersDoc(), input, 'a', at, id);
  if (!result.ok) throw new Error(result.error);
  return result.doc;
}
describe('paper list', () => {
  it('PA-01 validates strict empty documents', () => {
    expect(papersDocSchema.parse(emptyPapersDoc())).toEqual(emptyPapersDoc());
    expect(papersDocSchema.safeParse({ ...emptyPapersDoc(), extra: 1 }).success).toBe(false);
  });
  it('PA-02 normalises DOI prefixes and rejects junk', () => {
    for (const value of ['DOI:10.1234/ABC', 'https://doi.org/10.1234/ABC', 'http://dx.doi.org/10.1234/ABC'])
      expect(normaliseDoi(value)).toBe('10.1234/abc');
    expect(normaliseDoi('junk')).toBeNull();
  });
  it('PA-03 adds immutably and rejects duplicate and invalid data', () => {
    const doc = emptyPapersDoc();
    const result = addPaper(doc, input, 'a', at, id);
    expect(doc.papers).toHaveLength(0);
    expect(result.ok && result.doc.log).toHaveLength(1);
    expect(addPaper(added(), { ...input, doi: 'https://doi.org/10.1234/abc' }, 'a', at, id)).toEqual({
      ok: false,
      error: 'duplicate_doi',
    });
    expect(addPaper(doc, { ...input, doi: 'bad' }, 'a', at, id)).toEqual({ ok: false, error: 'invalid_doi' });
    expect(addPaper(doc, { ...input, title: ' ' }, 'a', at, id)).toEqual({
      ok: false,
      error: 'invalid_title',
    });
  });
  it('PA-04 requires exclusion reason and repeats harmlessly', () => {
    const doc = added();
    expect(decide(doc, id, 'excluded', ' ', 'a', at)).toEqual({ ok: false, error: 'reason_required' });
    expect(decide(doc, 'missing', 'included', null, 'a', at)).toEqual({ ok: false, error: 'unknown_paper' });
    const excluded = decide(doc, id, 'excluded', ' reason ', 'a', at);
    if (!excluded.ok) throw new Error();
    expect(decide(excluded.doc, id, 'excluded', 'reason', 'a', at)).toEqual({ ok: true, doc: excluded.doc });
    const included = decide(excluded.doc, id, 'included', 'ignored', 'a', at);
    expect(included.ok && included.doc.papers[0]?.reason).toBeNull();
  });
  it('PA-05 attaches and matches DOI before hash, ignoring null hashes', () => {
    const doc = added();
    const result = attachModel(
      doc,
      id,
      { sourceHash: 'hash', sentences: 2, importedBy: 'a', importedAt: at },
      'a',
      at,
    );
    if (!result.ok) throw new Error();
    const read = readPaperModel(example);
    if (!read.ok) throw new Error();
    const view = structuredClone(read.model);
    view.document.metadata.doi = '10.1234/ABC';
    view.document.source.sha256 = 'other';
    expect(matchPaper(result.doc, view)?.id).toBe(id);
    view.document.metadata.doi = null;
    view.document.source.sha256 = 'hash';
    expect(matchPaper(result.doc, view)?.id).toBe(id);
    view.document.source.sha256 = null;
    expect(matchPaper(doc, view)).toBeUndefined();
    expect(result.doc.log).toHaveLength(2);
  });
  it('PA-06 takes metadata from the vendored model', () => {
    const read = readPaperModel(example);
    if (!read.ok) throw new Error();
    expect(read.model.document.metadata).toMatchObject(paperFromModel(read.model));
  });
});
