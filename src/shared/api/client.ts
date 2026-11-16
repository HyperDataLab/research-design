import { z } from 'zod';
import { projectSchema } from '../../core/project/schema';

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
  async function call(path: string, method = 'GET', body?: unknown): Promise<unknown> {
    const token = await options.getToken();
    if (!token) throw new ApiError(401, 'unauthenticated', 'Chưa đăng nhập.');
    let response: Response;
    try {
      response = await fetcher(options.baseUrl.replace(/\/$/, '') + path, {
        method,
        headers: {
          Authorization: 'Bearer ' + token,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
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
    return response.json();
  }
  return {
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
