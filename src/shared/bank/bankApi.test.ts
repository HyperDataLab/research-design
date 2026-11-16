import { expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api/client';
import { createBankClient } from './bankApi';

it('D53 sends the token and reads the exact release and snapshot paths', async () => {
  const release = { release: '2031.02.1', date: '2031-02-01T00:00:00Z', notes: 'Test', includesDrafts: true };
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(JSON.stringify(release)))
    .mockResolvedValueOnce(new Response('{"raw":true}'));
  const api = createBankClient({
    baseUrl: 'https://bank.example/bank/v1/',
    getToken: async () => 'token',
    fetch: fetcher,
  });
  expect(await api.getRelease()).toEqual(release);
  expect(await api.getSnapshot()).toEqual({ raw: true });
  expect(fetcher).toHaveBeenNthCalledWith(1, 'https://bank.example/bank/v1/release', {
    method: 'GET',
    headers: { Authorization: 'Bearer token' },
  });
  expect(fetcher).toHaveBeenNthCalledWith(
    2,
    'https://bank.example/bank/v1/snapshot?collections=designs,threats,claim-types,metrics,protocols,benchmarks',
    expect.anything(),
  );
});

it('D53 maps HTTP errors, retry seconds, missing tokens and network failures', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'rate_limited', message: 'Slow down' }), {
        status: 429,
        headers: { 'Retry-After': '23' },
      }),
    )
    .mockRejectedValueOnce(new Error('offline'));
  const api = createBankClient({ baseUrl: '', getToken: async () => 'token', fetch: fetcher });
  await expect(api.getRelease()).rejects.toMatchObject({
    status: 429,
    code: 'rate_limited',
    message: 'Slow down',
    retryAfter: 23,
  });
  await expect(api.getSnapshot()).rejects.toMatchObject({ status: 0, code: 'network' });
  const signedOut = createBankClient({ baseUrl: '', getToken: async () => null, fetch: fetcher });
  await expect(signedOut.getRelease()).rejects.toBeInstanceOf(ApiError);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
