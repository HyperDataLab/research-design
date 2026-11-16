import example from '../../../schemas/vendor/paper-model-v1.example.json';
import { readPaperModel } from './paperModel';

const copy = () => structuredClone(example) as Record<string, unknown> & typeof example;

describe('reading a PaperLab paper model', () => {
  it('FR-201: the vendored example is accepted', () => {
    const result = readPaperModel(copy());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model.sentences[0]?.key).toMatch(/^[0-9a-f]{16}#\d+$/);
      expect(result.model.document.blocks).toEqual(example.document.blocks);
    }
  });

  it('FR-201: another format or version is refused in one sentence', () => {
    expect(readPaperModel({ hello: 1 })).toEqual({ ok: false, reason: 'not_a_paper_model', issues: [] });
    expect(readPaperModel('text')).toMatchObject({ ok: false, reason: 'not_a_paper_model' });
    expect(readPaperModel({ ...copy(), schemaVersion: 2 })).toEqual({
      ok: false,
      reason: 'unsupported_version',
      issues: ['schemaVersion 2'],
    });
  });

  it('FR-201: what the vendored schema refuses is refused, with the path', () => {
    const extra = { ...copy(), extra: 1 };
    expect(readPaperModel(extra)).toMatchObject({ ok: false, reason: 'invalid' });
    const badKey = copy();
    badKey.sentences[0]!.key = 'x';
    const result = readPaperModel(badKey);
    expect(result).toMatchObject({ ok: false, reason: 'invalid' });
    if (!result.ok) expect(result.issues[0]).toContain('sentences.0.key');
    const badAnnotation = copy();
    (badAnnotation.annotations as unknown[])[0] = { scheme: 'nope' };
    expect(readPaperModel(badAnnotation)).toMatchObject({ ok: false, reason: 'invalid' });
  });
});
