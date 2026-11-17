import { z } from 'zod';
import { ApiError } from '@/shared/api/client';

const releaseSchema = z.object({
  release: z.string(),
  date: z.string(),
  notes: z.string(),
  includesDrafts: z.boolean(),
});

export function createBankClient(options: {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  fetch?: typeof fetch;
}) {
  const fetcher = options.fetch ?? fetch;
  async function get(path: string): Promise<unknown> {
    const token = await options.getToken();
    if (!token) throw new ApiError(401, 'unauthenticated', 'Chưa đăng nhập.');
    let response: Response;
    try {
      response = await fetcher(options.baseUrl.replace(/\/$/, '') + path, {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token },
      });
    } catch {
      throw new ApiError(0, 'network', 'Không kết nối được máy chủ.');
    }
    if (!response.ok) {
      const body = z
        .object({ error: z.string(), message: z.string() })
        .safeParse(await response.json().catch(() => null));
      const error = new ApiError(
        response.status,
        body.success ? body.data.error : 'unknown',
        body.success ? body.data.message : 'Không thể hoàn tất yêu cầu.',
      );
      const retry = response.headers.get('Retry-After');
      if (response.status === 429 && retry && /^\d+$/.test(retry))
        Object.assign(error, { retryAfter: Number(retry) });
      throw error;
    }
    return response.json();
  }
  return {
    getRelease: async () => releaseSchema.parse(await get('/release')),
    getSnapshot: () => get('/snapshot?collections=designs,threats,claim-types,metrics,protocols,benchmarks'),
  };
}
