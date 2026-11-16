import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { ApiProvider } from '@/shared/api/ApiProvider';
import { ApiError, type ApiClient } from '@/shared/api/client';
import { AuthContext, type AuthValue } from '@/shared/auth/authContext';
import { ProjectContext } from '@/shared/project/projectContext';

const user = { uid: 'a', email: 'a@hyperdatalab.org', name: 'a' };
const project = {
  id: '0123456789abcdef',
  title: 'Study',
  owner: user.email,
  members: [user.email],
  archived: false,
  createdAt: '2026-11-16T00:00:00Z',
  updatedAt: '2026-11-16T00:00:00Z',
};
const auth: AuthValue = {
  user,
  ready: true,
  mode: 'firebase',
  error: '',
  signIn: vi.fn(),
  signOut: vi.fn(),
  getIdToken: vi.fn(),
};
export function setupClient() {
  const docs = new Map<string, { data: unknown; etag: string }>();
  const items = new Map<string, { data: unknown; etag: string }>();
  let version = 0;
  const put = (map: typeof docs, key: string, data: unknown, etag: string | null) => {
    if ((map.get(key)?.etag ?? null) !== etag) throw new ApiError(412, 'precondition_failed', 'conflict');
    const next = String(++version);
    map.set(key, { data, etag: next });
    return next;
  };
  const api: ApiClient = {
    getDoc: vi.fn(async (id, kind) => docs.get(`${id}/${kind}`) ?? null),
    putDoc: vi.fn(async (id, kind, data, etag) => put(docs, `${id}/${kind}`, data, etag)),
    getItem: vi.fn(async (id, collection, key) => items.get(`${id}/${collection}/${key}`) ?? null),
    putItem: vi.fn(async (id, collection, key, data, etag) =>
      put(items, `${id}/${collection}/${key}`, data, etag),
    ),
    listItems: vi.fn(),
    me: vi.fn(),
    listProjects: vi.fn(),
    createProject: vi.fn(),
    getProject: vi.fn(),
    patchProject: vi.fn(),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={auth}>
      <ApiProvider client={api}>
        <ProjectContext.Provider value={{ project, readOnly: project.archived }}>
          {children}
        </ProjectContext.Provider>
      </ApiProvider>
    </AuthContext.Provider>
  );
  return { api, docs, items, wrapper, project, auth };
}
export function file(content: string, size?: number) {
  const result = new File([content], 'model.json', { type: 'application/json' });
  Object.defineProperty(result, 'text', { value: async () => content });
  if (size !== undefined) Object.defineProperty(result, 'size', { value: size });
  return result;
}
