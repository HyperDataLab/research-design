import { z } from 'zod';
import { projectSchema } from '../../core/project/schema';
import type { DocKind, ItemCollection } from '../../core/project/storage';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export function createApiClient(options: {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  fetch?: typeof fetch;
}) {
  const fetcher = options.fetch ?? fetch;
  async function request(
    path: string,
    method = 'GET',
    body?: unknown,
    etag?: string | null,
  ): Promise<Response> {
    const token = await options.getToken();
    if (!token) throw new ApiError(401, 'unauthenticated', 'Chưa đăng nhập.');
    let response: Response;
    try {
      response = await fetcher(options.baseUrl.replace(/\/$/, '') + path, {
        method,
        headers: {
          Authorization: 'Bearer ' + token,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(etag == null ? {} : { 'If-Match': etag }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new ApiError(0, 'network', 'Không kết nối được máy chủ.');
    }
    if (!response.ok) {
      const error = z
        .object({ error: z.string(), message: z.string() })
        .safeParse(await response.json().catch(() => null));
      throw new ApiError(
        response.status,
        error.success ? error.data.error : 'unknown',
        error.success ? error.data.message : 'Không thể hoàn tất yêu cầu.',
      );
    }
    return response;
  }
  async function call(path: string, method = 'GET', body?: unknown): Promise<unknown> {
    return (await request(path, method, body)).json();
  }
  const path = (projectId: string, area: string, name: string, key?: string) =>
    `/v1/projects/${encodeURIComponent(projectId)}/${area}/${encodeURIComponent(name)}${key === undefined ? '' : '/' + encodeURIComponent(key)}`;
  async function get(pathname: string) {
    try {
      const response = await request(pathname);
      const { data } = z.object({ data: z.unknown() }).parse(await response.json());
      const etag = response.headers.get('ETag');
      if (!etag) throw new Error('Missing ETag');
      return { data, etag };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }
  async function put(pathname: string, data: unknown, etag: string | null) {
    const response = await request(pathname, 'PUT', { data }, etag);
    const next = response.headers.get('ETag');
    if (!next) throw new Error('Missing ETag');
    return next;
  }
  return {
    getDoc: (projectId: string, kind: DocKind) => get(path(projectId, 'docs', kind)),
    putDoc: (projectId: string, kind: DocKind, data: unknown, etag: string | null) =>
      put(path(projectId, 'docs', kind), data, etag),
    listItems: async (projectId: string, collection: ItemCollection) =>
      z
        .strictObject({ items: z.array(z.strictObject({ key: z.string(), etag: z.string() })) })
        .parse(await call(path(projectId, 'items', collection))).items,
    getItem: (projectId: string, collection: ItemCollection, key: string) =>
      get(path(projectId, 'items', collection, key)),
    putItem: (
      projectId: string,
      collection: ItemCollection,
      key: string,
      data: unknown,
      etag: string | null,
    ) => put(path(projectId, 'items', collection, key), data, etag),
    me: async () =>
      z.strictObject({ uid: z.string(), email: z.string(), name: z.string() }).parse(await call('/v1/me')),
    listProjects: async () =>
      z.strictObject({ projects: z.array(projectSchema) }).parse(await call('/v1/projects')).projects,
    createProject: async (title: string) =>
      projectSchema.parse(await call('/v1/projects', 'POST', { title })),
    getProject: async (id: string) =>
      projectSchema.parse(await call('/v1/projects/' + encodeURIComponent(id))),
    patchProject: async (id: string, patch: { title?: string; archived?: boolean }) =>
      projectSchema.parse(await call('/v1/projects/' + encodeURIComponent(id), 'PATCH', patch)),
  };
}
export type ApiClient = ReturnType<typeof createApiClient>;
