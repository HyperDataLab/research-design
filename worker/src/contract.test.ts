import { expect, it } from 'vitest';
import { createApiClient } from '../../src/shared/api/client';
import { handle, type Deps } from './app';
import { MemoryBucket } from './memoryBucket';
import { addPaper, emptyPapersDoc, papersDocSchema } from '../../src/core/papers/papers';
import { updateDoc } from '../../src/shared/api/updateDoc';
it('PJ-05 client and Worker agree on project operations', async () => {
  const deps: Deps = {
    llm: null,
    llmProvider: 'test',
    bucket: new MemoryBucket(),
    allowedOrigins: [],
    allowedDomain: 'hyperdatalab.org',
    now: () => new Date(),
    verifyToken: async () => ({ uid: 'a', email: 'a@hyperdatalab.org', name: 'a' }),
  };
  const fetcher: typeof fetch = (input, init) => handle(deps, new Request(input, init));
  const api = createApiClient({
    baseUrl: 'https://worker.test',
    getToken: async () => 'token',
    fetch: fetcher,
  });
  const project = await api.createProject('First');
  expect((await api.listProjects())[0]?.id).toBe(project.id);
  expect((await api.patchProject(project.id, { title: 'Renamed' })).title).toBe('Renamed');
  await api.patchProject(project.id, { archived: true });
  expect((await api.getProject(project.id)).archived).toBe(true);
});
it('PA-12 retries a real conflict and preserves both papers', async () => {
  const deps: Deps = {
    llm: null,
    llmProvider: 'test',
    bucket: new MemoryBucket(),
    allowedOrigins: [],
    allowedDomain: 'hyperdatalab.org',
    now: () => new Date(),
    verifyToken: async () => ({ uid: 'a', email: 'a@hyperdatalab.org', name: 'a' }),
  };
  const fetcher: typeof fetch = (input, init) => handle(deps, new Request(input, init));
  const make = () =>
    createApiClient({ baseUrl: 'https://worker.test', getToken: async () => 'token', fetch: fetcher });
  const a = make(),
    b = make();
  const project = await a.createProject('Test');
  await a.putDoc(project.id, 'papers', emptyPapersDoc(), null);
  let first = true;
  const client = {
    getDoc: b.getDoc,
    putDoc: async (...args: Parameters<typeof b.putDoc>) => {
      if (first) {
        first = false;
        await updateDoc({
          client: a,
          projectId: project.id,
          kind: 'papers',
          schema: papersDocSchema,
          empty: emptyPapersDoc,
          change: (doc) =>
            addPaper(
              doc,
              { title: 'A', authors: [], year: null, venue: null, doi: null },
              'a',
              '2025-01-01T00:00:00Z',
              'p-000000000001',
            ),
        });
      }
      return b.putDoc(...args);
    },
  };
  await updateDoc({
    client,
    projectId: project.id,
    kind: 'papers',
    schema: papersDocSchema,
    empty: emptyPapersDoc,
    change: (doc) =>
      addPaper(
        doc,
        { title: 'B', authors: [], year: null, venue: null, doi: null },
        'a',
        '2025-01-01T00:00:00Z',
        'p-000000000002',
      ),
  });
  const doc = papersDocSchema.parse((await a.getDoc(project.id, 'papers'))?.data);
  expect(doc.papers).toHaveLength(2);
  expect(doc.log).toHaveLength(2);
});
it('PA-13 item operations use etags', async () => {
  const deps: Deps = {
    llm: null,
    llmProvider: 'test',
    bucket: new MemoryBucket(),
    allowedOrigins: [],
    allowedDomain: 'hyperdatalab.org',
    now: () => new Date(),
    verifyToken: async () => ({ uid: 'a', email: 'a@hyperdatalab.org', name: 'a' }),
  };
  const api = createApiClient({
    baseUrl: 'https://worker.test',
    getToken: async () => 'token',
    fetch: (input, init) => handle(deps, new Request(input, init)),
  });
  const project = await api.createProject('Test');
  const etag = await api.putItem(project.id, 'paper-models', 'p-1', { x: 1 }, null);
  expect(await api.listItems(project.id, 'paper-models')).toEqual([{ key: 'p-1', etag }]);
  expect(await api.getItem(project.id, 'paper-models', 'p-1')).toEqual({ data: { x: 1 }, etag });
  await api.putItem(project.id, 'paper-models', 'p-1', { x: 2 }, etag);
  await expect(api.putItem(project.id, 'paper-models', 'p-1', {}, etag)).rejects.toMatchObject({
    status: 412,
  });
});
