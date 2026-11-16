import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import example from '../../../schemas/vendor/paper-model-v1.example.json';
import { addPaper, emptyPapersDoc } from '@/core/papers/papers';
import { useCorpus } from './useCorpus';
import { file, setupClient } from './testSupport';
const input = { title: 'Synthetic', authors: [], year: null, venue: null, doi: '10.1234/example' };
async function setup() {
  const context = setupClient();
  const hook = renderHook(() => useCorpus(), { wrapper: context.wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return { ...context, ...hook };
}
describe('useCorpus', () => {
  it('CO-03 adds a paper and log; CO-04 rejects duplicate DOI without writing', async () => {
    const { result, api } = await setup();
    await act(async () => {
      expect((await result.current.add(input)).ok).toBe(true);
    });
    expect(result.current.doc.papers).toHaveLength(1);
    expect(result.current.doc.log).toHaveLength(1);
    await act(async () => {
      expect(await result.current.add(input)).toMatchObject({ ok: false, error: 'duplicate_doi' });
    });
    expect(api.putDoc).toHaveBeenCalledTimes(1);
  });
  it('CO-05 creates from model; CO-06 imports again with item etag', async () => {
    const { result, api, items } = await setup();
    const modelFile = file(JSON.stringify(example));
    await act(async () => {
      expect(await result.current.importModel(modelFile)).toMatchObject({ ok: true, created: true });
    });
    const paper = result.current.doc.papers[0];
    expect(paper?.model).not.toBeNull();
    expect(items.size).toBe(1);
    expect(api.putItem).toHaveBeenCalledWith(expect.any(String), 'paper-models', paper?.id, example, null);
    await act(async () => {
      expect(await result.current.importModel(modelFile)).toMatchObject({ ok: true, created: false });
    });
    expect(result.current.doc.papers).toHaveLength(1);
    expect(vi.mocked(api.putItem).mock.calls[1]?.[4]).toBe('1');
  });
  it('CO-07 matches a manually added DOI', async () => {
    const { result } = await setup();
    const model = {
      ...example,
      document: { ...example.document, metadata: { ...example.document.metadata, doi: input.doi } },
    };
    await act(async () => {
      await result.current.add(input);
    });
    await act(async () => {
      expect(await result.current.importModel(file(JSON.stringify(model)))).toMatchObject({
        ok: true,
        created: false,
      });
    });
    expect(result.current.doc.papers).toHaveLength(1);
  });
  it('CO-08 refuses unsupported, non-JSON and oversized files without writes', async () => {
    const { result, api } = await setup();
    await act(async () => {
      expect(
        await result.current.importModel(file(JSON.stringify({ ...example, schemaVersion: 2 }))),
      ).toMatchObject({ ok: false, error: 'unsupported_version' });
      expect(await result.current.importModel(file('{'))).toMatchObject({ ok: false, error: 'not_json' });
      expect(await result.current.importModel(file('', 8 * 1024 * 1024 + 1))).toMatchObject({
        ok: false,
        error: 'too_large',
      });
    });
    expect(api.putDoc).not.toHaveBeenCalled();
    expect(api.putItem).not.toHaveBeenCalled();
  });
  it('CO-09 requires an exclusion reason', async () => {
    const { result } = await setup();
    await act(async () => {
      await result.current.add(input);
    });
    const id = result.current.doc.papers[0]?.id ?? '';
    await act(async () => {
      expect(await result.current.decide(id, 'excluded', '')).toMatchObject({
        ok: false,
        error: 'reason_required',
      });
    });
  });
  it('CO-07 attaches to a DOI added while importing', async () => {
    const { result, api, docs, project, items } = await setup();
    const model = {
      ...example,
      document: { ...example.document, metadata: { ...example.document.metadata, doi: input.doi } },
    };
    const added = addPaper(emptyPapersDoc(), input, 'other', '2026-01-01T00:00:00Z', 'p-000000000001');
    if (!added.ok) throw Error();
    const original = vi.mocked(api.putItem).getMockImplementation();
    vi.mocked(api.putItem).mockImplementationOnce(async (...args) => {
      if (!original) throw Error();
      const etag = await original(...args);
      docs.set(`${project.id}/papers`, { data: added.doc, etag: 'concurrent' });
      return etag;
    });
    await act(async () => {
      expect(await result.current.importModel(file(JSON.stringify(model)))).toMatchObject({
        ok: true,
        created: false,
      });
    });
    expect(result.current.doc.papers).toHaveLength(1);
    expect(result.current.doc.papers[0]?.model).not.toBeNull();
    expect(items.has(`${project.id}/paper-models/p-000000000001`)).toBe(true);
  });
});
