import { expect, it } from 'vitest';
import { createApiClient } from '../../src/shared/api/client';
import { handle, type Deps } from './app';
import { MemoryBucket } from './memoryBucket';
it('PJ-05 client and Worker agree on project operations', async () => {
  const deps: Deps = {
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
