import { describe, expect, it } from 'vitest';
import { CONSENT_VERSION } from '../../src/core/llm/contract';
import { handle, type Deps } from './app';
import { MemoryBucket } from './memoryBucket';
import { emptyDay } from './ledger';

const projectId = '1234567890abcdef';
const message = 'private message content';
function setup() {
  const bucket = new MemoryBucket();
  let calls = 0;
  let fetcher: typeof fetch = async () => {
    calls++;
    return Response.json({
      choices: [{ message: { content: 'answer' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 3, completion_tokens: 2 },
    });
  };
  const deps: Deps = {
    bucket,
    allowedOrigins: [],
    allowedDomain: 'hyperdatalab.org',
    now: () => new Date('2026-11-16T12:00:00Z'),
    verifyToken: async () => ({ uid: 'a', email: 'a@hyperdatalab.org', name: 'a' }),
    llmProvider: 'test',
    llm: {
      baseUrl: 'https://example.test/v1',
      apiKey: 'secret-key',
      model: 'model',
      provider: 'test',
      dailyTokenBudget: 100,
      maxOutputTokens: 10,
      timeoutMs: 100,
      fetch: (...args) => fetcher(...args),
    },
  };
  bucket.values.set(`researchdesign/projects/${projectId}/project.json`, {
    value: JSON.stringify({ members: ['a@hyperdatalab.org'], archived: false }),
    etag: 'project',
  });
  const call = (method: string, path: string, data?: unknown) =>
    handle(
      deps,
      new Request(`https://worker.test${path}`, {
        method,
        headers: { Authorization: 'Bearer token' },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      }),
    );
  const accept = () => call('PUT', '/v1/consent', { version: CONSENT_VERSION, provider: 'test' });
  const input = {
    projectId,
    feature: 'plan_suggestion',
    promptVersion: 'plan_suggestion@1',
    messages: [{ role: 'user', content: message }],
  };
  const chat = (data: unknown = input) => call('POST', '/v1/llm/chat', data);
  return {
    bucket,
    deps,
    call,
    accept,
    input,
    chat,
    get calls() {
      return calls;
    },
    setFetch: (f: typeof fetch) => {
      fetcher = f;
    },
  };
}
describe('AI calls', () => {
  it('LM-01 records the current consent for the caller', async () => {
    const s = setup();
    expect(await (await s.call('GET', '/v1/consent')).json()).toMatchObject({
      accepted: null,
      configured: true,
    });
    expect((await s.call('PUT', '/v1/consent', { version: 99, provider: 'test' })).status).toBe(409);
    expect((await s.call('PUT', '/v1/consent', { version: CONSENT_VERSION, provider: 'other' })).status).toBe(
      409,
    );
    expect(await (await s.accept()).json()).toMatchObject({
      accepted: { acceptedBy: 'a@hyperdatalab.org', acceptedAt: '2026-11-16T12:00:00.000Z' },
    });
  });
  it('LM-02 refuses calls before consent', async () => {
    const s = setup();
    expect((await s.chat()).status).toBe(403);
    expect(s.calls).toBe(0);
    expect([...s.bucket.values.keys()].some((k) => k.includes('/usage/'))).toBe(false);
  });
  it('LM-03 validates and forwards only allowlisted fields', async () => {
    const s = setup();
    await s.accept();
    for (const field of ['model', 'n', 'stream', 'tools'])
      expect((await s.chat({ ...s.input, [field]: 1 })).status).toBe(400);
    let sent: Record<string, unknown> = {};
    s.setFetch(async (_url, init) => {
      sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({ choices: [{ message: { content: 'x' } }] });
    });
    expect((await s.chat()).status).toBe(200);
    expect(Object.keys(sent).sort()).toEqual(['max_tokens', 'messages', 'model', 'temperature']);
    expect(sent.model).toBe('model');
  });
  it('LM-04 checks configuration and project access', async () => {
    const s = setup();
    s.deps.llm = null;
    expect((await s.chat()).status).toBe(503);
    expect(await (await s.call('GET', '/v1/llm/usage')).json()).toMatchObject({ dailyBudget: 0 });
    const t = setup();
    await t.accept();
    expect((await t.chat({ ...t.input, projectId: 'aaaaaaaaaaaaaaaa' })).status).toBe(404);
    t.bucket.values.set(`researchdesign/projects/${projectId}/project.json`, {
      value: JSON.stringify({ members: ['a@hyperdatalab.org'], archived: true }),
      etag: 'x',
    });
    expect((await t.chat()).status).toBe(409);
  });
  it('LM-05 settles reported usage', async () => {
    const s = setup();
    await s.accept();
    expect(await (await s.chat()).json()).toMatchObject({
      content: 'answer',
      finishReason: 'stop',
      model: 'model',
      usage: { inputTokens: 3, outputTokens: 2, estimated: false },
    });
    const day = JSON.parse(
      s.bucket.values.get('researchdesign/usage/a@hyperdatalab.org/2026-11-16.json')!.value,
    );
    expect(day.entries).toHaveLength(1);
    expect(day.reservations).toHaveLength(0);
  });
  it('LM-06 estimates missing usage', async () => {
    const s = setup();
    await s.accept();
    s.setFetch(async () => Response.json({ choices: [{ message: { content: 'answer' } }] }));
    expect(await (await s.chat()).json()).toMatchObject({
      usage: { estimated: true, inputTokens: 6, outputTokens: 2 },
    });
  });
  it('LM-07 rejects calls beyond budget', async () => {
    const s = setup();
    await s.accept();
    s.deps.llm!.dailyTokenBudget = 1;
    expect((await s.chat()).status).toBe(429);
    expect(s.calls).toBe(0);
  });
  it('LM-08 reserves concurrent calls at the budget edge', async () => {
    const s = setup();
    await s.accept();
    s.deps.llm!.dailyTokenBudget = 16;
    // First-ever writes are read-then-write, so seed the day to exercise conditional puts.
    s.bucket.values.set('researchdesign/usage/a@hyperdatalab.org/2026-11-16.json', {
      value: JSON.stringify(emptyDay()),
      etag: 'seed',
    });
    let count = 0;
    s.setFetch(async () => {
      count++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return Response.json({ choices: [{ message: { content: 'ok' } }] });
    });
    const responses = await Promise.all([s.chat(), s.chat()]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 429]);
    expect(count).toBe(1);
  });
  it('LM-09 hides upstream failures and releases reservations', async () => {
    for (const fetcher of [
      async () => {
        throw new Error('secret-key');
      },
      async () => new Response('secret-key upstream body', { status: 500 }),
      async () => Response.json({}),
    ]) {
      const s = setup();
      await s.accept();
      s.setFetch(fetcher);
      const response = await s.chat();
      expect(response.status).toBe(502);
      expect(await response.text()).not.toContain('secret-key');
      expect(
        JSON.parse(s.bucket.values.get('researchdesign/usage/a@hyperdatalab.org/2026-11-16.json')!.value)
          .reservations,
      ).toHaveLength(0);
    }
  });
  it('LM-10 times out and releases the reservation', async () => {
    const s = setup();
    await s.accept();
    s.deps.llm!.timeoutMs = 5;
    s.setFetch(async () => new Promise<Response>(() => {}));
    expect((await s.chat()).status).toBe(504);
    expect(
      JSON.parse(s.bucket.values.get('researchdesign/usage/a@hyperdatalab.org/2026-11-16.json')!.value)
        .reservations,
    ).toHaveLength(0);
  });
  it('LM-11 retains a reservation when conditional settlement fails', async () => {
    const s = setup();
    await s.accept();
    const put = s.bucket.put.bind(s.bucket);
    s.setFetch(async () => {
      s.bucket.put = async (key, value, options) => (options ? null : put(key, value, options));
      return Response.json({ choices: [{ message: { content: 'ok' } }] });
    });
    expect((await s.chat()).status).toBe(200);
    expect(
      JSON.parse(s.bucket.values.get('researchdesign/usage/a@hyperdatalab.org/2026-11-16.json')!.value)
        .reservations,
    ).toHaveLength(1);
    expect(s.bucket.values.has('researchdesign/usage/a@hyperdatalab.org/2026-11.json')).toBe(false);
  });
  it('LM-12 summarizes usage and expires old reservations on the next write', async () => {
    const s = setup();
    await s.accept();
    await s.chat();
    const key = 'researchdesign/usage/a@hyperdatalab.org/2026-11-16.json';
    const day = JSON.parse(s.bucket.values.get(key)!.value);
    day.reservations.push({
      id: '1234567890abcdef',
      at: '2026-11-16T11:00:00Z',
      tokens: 5,
      projectId,
      feature: 'plan_suggestion',
      promptVersion: 'plan_suggestion@1',
      model: 'model',
    });
    s.bucket.values.set(key, { value: JSON.stringify(day), etag: 'old' });
    await s.chat();
    expect(await (await s.call('GET', '/v1/llm/usage')).json()).toMatchObject({
      dailyBudget: 100,
      today: { calls: 3, estimatedCalls: 1, reservedTokens: 0 },
      month: { calls: 3 },
      byFeature: [{ feature: 'plan_suggestion', calls: 3 }],
    });
  });
  it('LM-13 never stores message text in usage objects', async () => {
    const s = setup();
    await s.accept();
    await s.chat();
    for (const [key, value] of s.bucket.values)
      if (key.startsWith('researchdesign/usage/')) expect(value.value).not.toContain(message);
  });
  it('LM-14 a failed month update does not undo a settled day', async () => {
    const s = setup();
    await s.accept();
    const put = s.bucket.put.bind(s.bucket);
    s.setFetch(async () => {
      s.bucket.put = async (key, value, options) =>
        key.endsWith('/2026-11.json') ? null : put(key, value, options);
      return Response.json({ choices: [{ message: { content: 'ok' } }] });
    });
    expect((await s.chat()).status).toBe(200);
    const day = JSON.parse(
      s.bucket.values.get('researchdesign/usage/a@hyperdatalab.org/2026-11-16.json')!.value,
    );
    expect(day.entries).toHaveLength(1);
    expect(day.reservations).toHaveLength(0);
    expect(s.bucket.values.has('researchdesign/usage/a@hyperdatalab.org/2026-11.json')).toBe(false);
  });
  it('LM-15 a corrupt day object stops calls', async () => {
    const s = setup();
    await s.accept();
    s.bucket.values.set('researchdesign/usage/a@hyperdatalab.org/2026-11-16.json', {
      value: JSON.stringify({ ...emptyDay(), totals: { inputTokens: -1, outputTokens: 0, calls: 0 } }),
      etag: 'corrupt',
    });
    const response = await s.chat();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: 'internal' });
    expect(s.calls).toBe(0);
  });
});
