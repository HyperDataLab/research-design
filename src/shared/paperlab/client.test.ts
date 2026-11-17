import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api/client';
import { createPaperLabClient } from './client';
const id = 'sha256-' + 'a'.repeat(64);
const item = {
  paperId: id,
  title: 'Invented',
  doi: null,
  sourceSha256: null,
  updatedAt: '2026-01-01T00:00:00Z',
  publishedBy: 'a@lab',
  experimentFacts: 'candidate',
  extra: true,
};
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers });
describe('PaperLab client', () => {
  it('follows empty pages and sends filters and token, ignoring unknown fields', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ items: [], nextCursor: 'next' }))
      .mockResolvedValueOnce(json({ items: [item], nextCursor: null }));
    const client = createPaperLabClient({
      baseUrl: 'https://lab/',
      getToken: async () => 'token',
      fetch: fetcher,
    });
    expect(await client.listPapers({ doi: '10.1/a', sourceSha256: 'abc' })).toEqual(
      [{ ...item, extra: undefined }].map(({ extra: _extra, ...rest }) => rest),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]?.[0]).toContain('cursor=next');
    expect(fetcher.mock.calls[0]?.[0]).toContain('sourceSha256=abc');
    expect(fetcher.mock.calls[0]?.[1].headers.Authorization).toBe('Bearer token');
  });
  it('limits pagination to 20 pages', async () => {
    const fetcher = vi.fn(async () => json({ items: [], nextCursor: 'next' }));
    const client = createPaperLabClient({
      baseUrl: 'https://lab',
      getToken: async () => 't',
      fetch: fetcher,
    });
    await expect(client.listPapers()).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(20);
  });
  it('retains ETags, handles missing facts and refuses unsafe ids', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ x: 1 }, 200, { ETag: '"v1"' }))
      .mockResolvedValueOnce(json({ error: 'not_found', message: 'missing' }, 404));
    const client = createPaperLabClient({
      baseUrl: 'https://lab',
      getToken: async () => 't',
      fetch: fetcher,
    });
    expect(await client.getModel(id)).toEqual({ data: { x: 1 }, etag: '"v1"' });
    expect(await client.getFacts('12345678-1234-1234-1234-123456789abc')).toBeNull();
    await expect(client.getModel('../bad')).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('maps API and network errors', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ error: 'forbidden', message: 'denied' }, 403))
      .mockRejectedValueOnce(new Error());
    const client = createPaperLabClient({
      baseUrl: 'https://lab',
      getToken: async () => 't',
      fetch: fetcher,
    });
    await expect(client.getModel(id)).rejects.toMatchObject({
      status: 403,
      code: 'forbidden',
      message: 'denied',
    });
    await expect(client.getModel(id)).rejects.toBeInstanceOf(ApiError);
    expect(() => createPaperLabClient({ baseUrl: '', getToken: async () => null })).toThrow();
  });
});
