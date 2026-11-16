import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './client';
describe('project client', () => {
  it('PJ-02 sends bearer token and parses the response', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ uid: 'a', email: 'a@hyperdatalab.org', name: 'a' }));
    const api = createApiClient({ baseUrl: '/api', getToken: async () => 'token', fetch: fetcher });
    expect(await api.me()).toMatchObject({ uid: 'a' });
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer token' });
  });
  it('PJ-03 maps HTTP and network failures', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ error: 'conflict', message: 'Conflict' }, { status: 409 }))
      .mockRejectedValueOnce(new Error('offline'));
    const api = createApiClient({ baseUrl: '', getToken: async () => 'token', fetch: fetcher });
    await expect(api.me()).rejects.toMatchObject({ status: 409, code: 'conflict' });
    await expect(api.me()).rejects.toMatchObject({ status: 0 });
  });
  it('PJ-04 does not fetch without a token', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const api = createApiClient({ baseUrl: '', getToken: async () => null, fetch: fetcher });
    await expect(api.me()).rejects.toBeInstanceOf(ApiError);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
