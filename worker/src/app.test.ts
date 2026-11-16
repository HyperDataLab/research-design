import { describe, expect, it } from 'vitest';
import { examplePlan } from '../../src/core/plan/examplePlan';
import { handle, PREFIX, type Deps } from './app';
import { NotAllowedError } from './auth';
import { MemoryBucket } from './memoryBucket';
import { emptyDraft } from '../../src/core/draft/schema';
import { addHypothesis, type DraftResult } from '../../src/core/draft/ops';
import {
  addMetric,
  addVariable,
  addDataset,
  addCondition,
  setHypothesisVariables,
} from '../../src/core/draft/measureOps';
import { setRunMatrix } from '../../src/core/draft/planOps';
import { draftToPlan } from '../../src/core/draft/toPlan';

function setup() {
  const bucket = new MemoryBucket();
  let time = '2026-11-16T09:00:00.000Z';
  const deps: Deps = {
    bucket,
    llm: null,
    llmProvider: 'test',
    allowedOrigins: ['https://app.test'],
    allowedDomain: 'hyperdatalab.org',
    now: () => new Date(time),
    verifyToken: async (token) => {
      if (token === 'bad') throw new Error('bad');
      if (token === 'foreign') throw new NotAllowedError();
      return { uid: token, email: `${token}@hyperdatalab.org`, name: token };
    },
  };
  const call = (
    method: string,
    path: string,
    data?: unknown,
    token = 'a',
    headers: Record<string, string> = {},
  ) =>
    handle(
      deps,
      new Request(`https://worker.test${path}`, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
        ...(data !== undefined && method !== 'GET' ? { body: JSON.stringify(data) } : {}),
      }),
    );
  const create = async (title = 'Project', token = 'a') =>
    ((await (await call('POST', '/v1/projects', { title }, token)).json()) as { id: string }).id;
  return {
    bucket,
    deps,
    call,
    create,
    setTime: (value: string) => {
      time = value;
    },
  };
}
describe('Worker API', () => {
  it('WF-01 freezes a mapped draft with server identity and enforces versions and gate', async () => {
    const doc = (r: DraftResult) => {
      if (!r.ok) throw new Error(r.error);
      return r.doc;
    };
    let draft = doc(
      addHypothesis(emptyDraft(), {
        statement: 'Outcome improves',
        kind: 'exploratory',
        question: null,
        claim: null,
      }),
    );
    draft = doc(
      addMetric(draft, {
        name: 'Score',
        key: 'score',
        unit: 'points',
        goal: 'maximize',
        aggregation: 'mean',
        protocol: 'Measure score',
        bank: null,
        protocolBank: null,
      }),
    );
    draft = doc(
      addVariable(draft, { name: 'Outcome', role: 'dependent', construct: '', metric: 'm-1', levels: [] }),
    );
    draft = doc(setHypothesisVariables(draft, 'h-1', { independent: [], dependent: ['v-1'] }));
    draft = doc(
      addDataset(draft, {
        name: 'Data',
        source: 'Lab',
        version: null,
        split: null,
        sha256: null,
        benchmark: null,
      }),
    );
    draft = doc(addCondition(draft, { name: 'Baseline', baseline: true, params: {} }));
    draft = doc(
      setRunMatrix(draft, {
        mlflowExperiment: 'Test',
        conditions: ['c-1'],
        datasets: ['d-1'],
        seeds: [1],
        sampleSizeJustification: 'Prior study',
      }),
    );
    const s = setup();
    const id = await s.create();
    const mapped = draftToPlan(draft, {
      planId: id,
      planVersion: 1,
      title: 'Plan',
      frozenAt: '2020-01-01T00:00:00Z',
      frozenBy: 'placeholder',
      deviation: null,
      appVersion: '1',
    });
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    const path = `/v1/projects/${id}/plans`;
    const blocked = { ...mapped.plan, runMatrix: { ...mapped.plan.runMatrix, expectedRuns: 2 } };
    expect((await s.call('PUT', `${path}/1`, blocked)).status).toBe(422);
    const response = await s.call('PUT', `${path}/1`, mapped.plan);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      frozenBy: 'a@hyperdatalab.org',
      frozenAt: '2026-11-16T09:00:00.000Z',
    });
    expect((await s.call('PUT', `${path}/1`, mapped.plan)).status).toBe(409);
    expect((await s.call('PUT', `${path}/2`, { ...mapped.plan, planVersion: 2 })).status).toBe(422);
    expect(
      (await s.call('PUT', `${path}/2`, { ...mapped.plan, planVersion: 2, deviation: 'Changed' })).status,
    ).toBe(201);
  });
  it('WK-01 authenticates and rejects foreign domains', async () => {
    const { call } = setup();
    expect((await call('GET', '/v1/me', undefined, '')).status).toBe(401);
    expect((await call('GET', '/v1/me', undefined, 'bad')).status).toBe(401);
    expect((await call('GET', '/v1/me', undefined, 'foreign')).status).toBe(403);
  });
  it('WK-02 handles CORS and unauthenticated preflight', async () => {
    const { call } = setup();
    const response = await call('OPTIONS', '/v1/me', undefined, '', { Origin: 'https://app.test' });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.test');
    expect(
      (await call('GET', '/v1/me', undefined, 'a', { Origin: 'https://evil.test' })).headers.get(
        'access-control-allow-origin',
      ),
    ).toBeNull();
    expect(
      (await call('GET', '/v1/me', undefined, 'a', { Origin: 'https://app.test' })).headers.get(
        'access-control-expose-headers',
      ),
    ).toBe('ETag');
  });
  it('WK-03 creates, lists in order, and gets projects', async () => {
    const s = setup();
    const first = await s.create('First');
    s.setTime('2026-11-17T09:00:00Z');
    const second = await s.create('Second');
    await s.create('Private', 'b');
    expect(await (await s.call('GET', '/v1/projects')).json()).toMatchObject({
      projects: [{ id: second }, { id: first }],
    });
    expect(await (await s.call('GET', `/v1/projects/${first}`)).json()).toMatchObject({
      title: 'First',
      owner: 'a@hyperdatalab.org',
    });
  });
  it('WK-04 hides every project route from nonmembers', async () => {
    const s = setup();
    const id = await s.create();
    for (const [method, suffix] of [
      ['GET', ''],
      ['PATCH', ''],
      ['GET', '/docs/draft'],
      ['PUT', '/docs/draft'],
      ['GET', '/items/facts'],
      ['GET', '/items/facts/key'],
      ['PUT', '/items/facts/key'],
      ['GET', '/plans'],
      ['GET', '/plans/1'],
      ['PUT', '/plans/1'],
    ]) {
      expect((await s.call(method!, `/v1/projects/${id}${suffix}`, {}, 'b')).status).toBe(404);
    }
  });
  it('WK-05 updates membership and markers with owner restrictions', async () => {
    const s = setup();
    const id = await s.create();
    const path = `/v1/projects/${id}`;
    expect(
      (await s.call('PATCH', path, { members: ['a@hyperdatalab.org', 'B@hyperdatalab.org'] })).status,
    ).toBe(200);
    expect((await s.call('PATCH', path, { title: ' Renamed ' }, 'b')).status).toBe(200);
    expect((await s.call('PATCH', path, { members: ['a@hyperdatalab.org'] }, 'b')).status).toBe(403);
    expect((await s.call('PATCH', path, { members: ['b@hyperdatalab.org'] })).status).toBe(400);
    expect((await s.call('PATCH', path, { members: ['a@hyperdatalab.org', 'x@example.com'] })).status).toBe(
      400,
    );
    expect((await s.call('PATCH', path, { extra: true })).status).toBe(400);
    await s.call('PATCH', path, { members: ['a@hyperdatalab.org'] });
    expect((await s.call('GET', path, undefined, 'b')).status).toBe(404);
    expect(await (await s.call('GET', '/v1/projects', undefined, 'b')).json()).toEqual({ projects: [] });
    expect(s.bucket.values.has(`${PREFIX}members/b@hyperdatalab.org/${id}`)).toBe(false);
  });
  it('WK-06 stores docs and items using conditional etags and size limits', async () => {
    const s = setup();
    const id = await s.create();
    const base = `/v1/projects/${id}`;
    expect((await s.call('GET', `${base}/docs/nope`)).status).toBe(404);
    expect((await s.call('GET', `${base}/items/nope`)).status).toBe(404);
    for (const suffix of ['/docs/draft', '/items/facts/paper-1']) {
      const path = base + suffix;
      const first = await s.call('PUT', path, { data: { x: 1 } });
      const etag = first.headers.get('etag')!;
      expect(first.status).toBe(200);
      expect((await s.call('GET', path)).headers.get('etag')).toBe(etag);
      expect((await s.call('PUT', path, { data: 2 })).status).toBe(412);
      for (const invalid of [etag.slice(1, -1), `W/${etag}`, '', '""', `${etag}, ${etag}`])
        expect((await s.call('PUT', path, { data: 2 }, 'a', { 'If-Match': invalid })).status).toBe(412);
      expect((await s.call('PUT', path, { data: 2 }, 'a', { 'If-Match': etag })).status).toBe(200);
      expect((await s.call('PUT', path, { data: 3 }, 'a', { 'If-Match': etag })).status).toBe(412);
      expect((await s.call('PUT', path, { data: 3 }, 'a', { 'If-Match': '*' })).status).toBe(412);
    }
    expect(await (await s.call('GET', `${base}/items/facts`)).json()).toMatchObject({
      items: [{ key: 'paper-1', etag: expect.any(String) }],
    });
    expect((await s.call('PUT', `${base}/docs/bank`, { data: 'x'.repeat(2 * 1024 * 1024) })).status).toBe(
      413,
    );
    expect(
      (await s.call('PUT', `${base}/items/facts/large`, { data: 'x'.repeat(8 * 1024 * 1024) })).status,
    ).toBe(413);
  });
  it('WK-07 archived projects allow reads and unarchiving only', async () => {
    const s = setup();
    const id = await s.create();
    const base = `/v1/projects/${id}`;
    await s.call('PUT', `${base}/docs/draft`, { data: 1 });
    await s.call('PATCH', base, { archived: true });
    expect((await s.call('GET', `${base}/docs/draft`)).status).toBe(200);
    for (const suffix of ['/docs/draft', '/items/facts/x', '/plans/1'])
      expect((await s.call('PUT', base + suffix, {})).status).toBe(409);
    expect((await s.call('PATCH', base, { title: 'No' })).status).toBe(409);
    expect((await s.call('PATCH', base, { archived: false })).status).toBe(200);
  });
  it('WK-08 freezes with server identity and time and lists and reads it', async () => {
    const s = setup();
    const id = await s.create();
    const base = `/v1/projects/${id}/plans`;
    const frozen = await s.call('PUT', `${base}/1`, examplePlan());
    expect(frozen.status).toBe(201);
    expect(await frozen.json()).toMatchObject({
      frozenBy: 'a@hyperdatalab.org',
      frozenAt: '2026-11-16T09:00:00.000Z',
    });
    expect(await (await s.call('GET', base)).json()).toMatchObject({
      versions: [{ version: 1, frozenBy: 'a@hyperdatalab.org' }],
    });
    expect((await s.call('GET', `${base}/1`)).status).toBe(200);
  });
  it('WK-09 rejects invalid, blocked, inconsistent and nonsequential plans', async () => {
    const s = setup();
    const id = await s.create();
    const base = `/v1/projects/${id}/plans`;
    const plan = examplePlan();
    expect((await s.call('PUT', `${base}/1`, {})).status).toBe(422);
    const blocked = structuredClone(plan);
    blocked.runMatrix.expectedRuns = 1;
    expect(await (await s.call('PUT', `${base}/1`, blocked)).json()).toMatchObject({
      issues: expect.arrayContaining([expect.objectContaining({ rule: 'PP-03' })]),
    });
    expect((await s.call('PUT', `${base}/2`, plan)).status).toBe(400);
    expect((await s.call('PUT', `${base}/1`, plan)).status).toBe(201);
    expect((await s.call('PUT', `${base}/1`, plan)).status).toBe(409);
    const next = { ...plan, planVersion: 3, deviation: 'Changed' };
    expect((await s.call('PUT', `${base}/3`, next)).status).toBe(409);
    expect((await s.call('PUT', `${base}/2`, { ...next, planVersion: 2, planId: 'other' })).status).toBe(409);
  });
  it('WK-10 permits PP-07 and PP-08 warnings', async () => {
    const s = setup();
    const id = await s.create();
    const plan = examplePlan();
    plan.conditions.forEach((condition) => {
      condition.baseline = false;
    });
    plan.analyses[0]!.method = 'anova_oneway';
    expect((await s.call('PUT', `/v1/projects/${id}/plans/1`, plan)).status).toBe(201);
  });
  it('WK-11 rejects invalid URL segments before accessing the bucket', async () => {
    const s = setup();
    const id = await s.create();
    for (const path of [
      '/v1/projects/BAD',
      `/v1/projects/${id}/docs/bad`,
      `/v1/projects/${id}/items/bad/x`,
      `/v1/projects/${id}/items/facts/a%2Fb`,
      `/v1/projects/${id}/plans/01`,
    ]) {
      s.bucket.touched = [];
      expect((await s.call('GET', path)).status).toBe(404);
      expect(s.bucket.touched).toEqual([]);
    }
  });
  it('WK-12 an unexpected error is a 500 with CORS headers', async () => {
    const s = setup();
    s.bucket.get = async () => {
      throw new Error('private details');
    };
    const response = await s.call('GET', '/v1/projects/0123456789abcdef', undefined, 'a', {
      Origin: 'https://app.test',
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'internal', message: 'Unexpected error.' });
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.test');
    expect(response.headers.get('access-control-expose-headers')).toBe('ETag');
    expect(response.headers.get('vary')).toBe('Origin');
  });
});
