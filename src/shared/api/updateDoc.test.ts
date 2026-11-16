import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError } from './client';
import { updateDoc } from './updateDoc';
const schema = z.array(z.string());
const conflict = () => new ApiError(412, 'precondition_failed', 'stale');
const base = { projectId: 'p', kind: 'papers' as const, schema, empty: () => [] as string[] };
it('PA-07 uses null for first save and the etag for later saves', async () => {
  const client = {
    getDoc: vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ data: ['a'], etag: '"1"' }),
    putDoc: vi.fn().mockResolvedValue('"2"'),
  };
  const change = (doc: string[]) => ({ ok: true as const, doc: [...doc, 'b'] });
  await updateDoc({ ...base, client, change });
  await updateDoc({ ...base, client, change });
  expect(client.putDoc.mock.calls.map((call) => call[3])).toEqual([null, '"1"']);
});
it('PA-08 re-reads and re-applies after conflict', async () => {
  const client = {
    getDoc: vi
      .fn()
      .mockResolvedValueOnce({ data: [], etag: '"1"' })
      .mockResolvedValueOnce({ data: ['a'], etag: '"2"' }),
    putDoc: vi.fn().mockRejectedValueOnce(conflict()).mockResolvedValueOnce('"3"'),
  };
  const result = await updateDoc({ ...base, client, change: (doc) => ({ ok: true, doc: [...doc, 'b'] }) });
  expect(result).toEqual({ ok: true, doc: ['a', 'b'], etag: '"3"' });
});
it('PA-09 returns the current document when change no longer applies', async () => {
  const client = {
    getDoc: vi
      .fn()
      .mockResolvedValueOnce({ data: [], etag: '"1"' })
      .mockResolvedValueOnce({ data: ['a'], etag: '"2"' }),
    putDoc: vi.fn().mockRejectedValue(conflict()),
  };
  const result = await updateDoc({
    ...base,
    client,
    change: (doc) => (doc.length ? { ok: false, error: 'exists' } : { ok: true, doc: ['a'] }),
  });
  expect(result).toEqual({ ok: false, error: 'exists', doc: ['a'] });
  expect(client.putDoc).toHaveBeenCalledTimes(1);
});
it('PA-10 gives up after the configured attempts', async () => {
  const client = { getDoc: vi.fn().mockResolvedValue(null), putDoc: vi.fn().mockRejectedValue(conflict()) };
  await expect(
    updateDoc({ ...base, client, maxAttempts: 2, change: (doc) => ({ ok: true, doc: [...doc, 'a'] }) }),
  ).rejects.toMatchObject({ status: 412 });
  expect(client.putDoc).toHaveBeenCalledTimes(2);
});
it('PA-11 does not write an unchanged document', async () => {
  const client = { getDoc: vi.fn().mockResolvedValue({ data: [], etag: '"1"' }), putDoc: vi.fn() };
  await updateDoc({ ...base, client, change: (doc) => ({ ok: true, doc }) });
  expect(client.putDoc).not.toHaveBeenCalled();
});
