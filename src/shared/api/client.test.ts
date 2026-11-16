import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './client';
import { examplePlan } from '../../core/plan/examplePlan';

it('CL-01 lists, reads and freezes plans and preserves validation issues', async () => {
  const plan = examplePlan();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({ versions: [{ version: 1, frozenAt: plan.frozenAt, frozenBy: plan.frozenBy }] }),
    )
    .mockResolvedValueOnce(Response.json(plan))
    .mockResolvedValueOnce(Response.json(plan, { status: 201 }))
    .mockResolvedValueOnce(
      Response.json(
        { error: 'plan_invalid', message: 'Invalid', issues: [{ rule: 'PP-03' }] },
        { status: 422 },
      ),
    );
  const api = createApiClient({ baseUrl: '', getToken: async () => 'token', fetch: fetcher });
  expect(await api.listPlans('project')).toHaveLength(1);
  expect(await api.getPlan('project', 1)).toEqual(plan);
  expect(await api.freezePlan('project', plan)).toEqual(plan);
  await expect(api.freezePlan('project', plan)).rejects.toMatchObject({
    status: 422,
    code: 'plan_invalid',
    issues: [{ rule: 'PP-03' }],
  });
  expect(fetcher.mock.calls[2]?.[1]).toMatchObject({ method: 'PUT', body: JSON.stringify(plan) });
});
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

describe('LLM client', () => {
  const consent = { required: { version: 1, provider: 'Provider' }, accepted: null, configured: true };
  const usage = {
    day: '2026-11-16',
    dailyBudget: 100,
    today: { inputTokens: 0, outputTokens: 0, calls: 0, reservedTokens: 0, estimatedCalls: 0 },
    month: { inputTokens: 0, outputTokens: 0, calls: 0 },
    byFeature: [],
  };
  const response = {
    content: 'OK',
    finishReason: 'stop',
    model: 'model',
    usage: { inputTokens: 1, outputTokens: 1, estimated: false },
  };
  it('LC-04 calls and parses each endpoint', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(consent))
      .mockResolvedValueOnce(Response.json(consent))
      .mockResolvedValueOnce(Response.json(usage))
      .mockResolvedValueOnce(Response.json(response));
    const api = createApiClient({ baseUrl: '', getToken: async () => 'token', fetch: fetcher });
    expect(await api.getConsent()).toEqual(consent);
    expect(await api.acceptConsent(1, 'Provider')).toEqual(consent);
    expect(await api.getUsage()).toEqual(usage);
    const request = {
      projectId: '0123456789abcdef',
      feature: 'connection_test' as const,
      promptVersion: 'connection_test@1',
      messages: [{ role: 'user' as const, content: 'ping' }],
    };
    expect(await api.chat(request)).toEqual(response);
    expect(fetcher.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ['/v1/consent', 'GET'],
      ['/v1/consent', 'PUT'],
      ['/v1/llm/usage', 'GET'],
      ['/v1/llm/chat', 'POST'],
    ]);
    expect(fetcher.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ version: 1, provider: 'Provider' }));
    expect(fetcher.mock.calls[3]?.[1]?.body).toBe(JSON.stringify(request));
    fetcher.mockResolvedValueOnce(Response.json({}));
    await expect(api.getConsent()).rejects.toThrow();
  });
  it('LC-05 preserves consent and budget errors', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ error: 'consent_required', message: 'No' }, { status: 403 }))
      .mockResolvedValueOnce(Response.json({ error: 'budget_exceeded', message: 'No' }, { status: 429 }));
    const api = createApiClient({ baseUrl: '', getToken: async () => 'token', fetch: fetcher });
    await expect(api.getConsent()).rejects.toMatchObject({ status: 403, code: 'consent_required' });
    await expect(api.getUsage()).rejects.toMatchObject({ status: 429, code: 'budget_exceeded' });
  });
});
