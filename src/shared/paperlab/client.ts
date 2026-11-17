import { z } from 'zod';
import { ApiError } from '@/shared/api/client';

const itemSchema = z.object({
  paperId: z.string(),
  title: z.string(),
  doi: z.string().nullable(),
  sourceSha256: z.string().nullable(),
  updatedAt: z.string(),
  publishedBy: z.string(),
  experimentFacts: z.enum(['none', 'candidate', 'reviewed']),
});
export type PaperLabPaper = z.infer<typeof itemSchema>;
const pageSchema = z.object({ items: z.array(itemSchema), nextCursor: z.string().nullable() });
const validId = /^(?:sha256-[0-9a-f]{64}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
export function createPaperLabClient(options: {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  fetch?: typeof fetch;
}) {
  if (!options.baseUrl) throw new Error('PaperLab URL required');
  const fetcher = options.fetch ?? fetch;
  async function request(path: string) {
    const token = await options.getToken();
    if (!token) throw new ApiError(401, 'unauthenticated', 'Chưa đăng nhập.');
    let response: Response;
    try {
      response = await fetcher(options.baseUrl.replace(/\/$/, '') + path, {
        headers: { Authorization: 'Bearer ' + token },
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
  async function get(paperId: string, kind: string) {
    if (!validId.test(paperId)) throw new Error('Invalid PaperLab paper id');
    const response = await request('/v1/papers/' + encodeURIComponent(paperId) + '/' + kind);
    const etag = response.headers.get('ETag');
    if (!etag) throw new Error('Missing ETag');
    return { data: (await response.json()) as unknown, etag };
  }
  return {
    async listPapers(filters: { doi?: string; sourceSha256?: string } = {}) {
      const items: PaperLabPaper[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 20; page++) {
        const query = new URLSearchParams();
        if (filters.doi) query.set('doi', filters.doi);
        if (filters.sourceSha256) query.set('sourceSha256', filters.sourceSha256);
        if (cursor !== null) query.set('cursor', cursor);
        const suffix = query.toString();
        const result = pageSchema.parse(
          await (await request('/v1/papers' + (suffix ? '?' + suffix : ''))).json(),
        );
        items.push(...result.items);
        cursor = result.nextCursor;
        if (cursor === null) return items;
      }
      throw new Error('PaperLab page limit exceeded');
    },
    getModel: (paperId: string) => get(paperId, 'model'),
    async getFacts(paperId: string) {
      try {
        return await get(paperId, 'experiment-facts');
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  };
}
