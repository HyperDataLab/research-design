import type { z } from 'zod';
import type { DocKind } from '../../core/project/storage';
import { ApiError, type ApiClient } from './client';

export async function updateDoc<T, E>({
  client,
  projectId,
  kind,
  schema,
  empty,
  change,
  maxAttempts = 4,
}: {
  client: Pick<ApiClient, 'getDoc' | 'putDoc'>;
  projectId: string;
  kind: DocKind;
  schema: z.ZodType<T>;
  empty: () => T;
  change: (doc: T) => { ok: true; doc: T } | { ok: false; error: E };
  maxAttempts?: number;
}): Promise<{ ok: true; doc: T; etag: string | null } | { ok: false; error: E; doc: T }> {
  let conflict: ApiError | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const stored = await client.getDoc(projectId, kind);
    const doc = schema.parse(stored ? stored.data : empty());
    const result = change(doc);
    if (!result.ok) return { ...result, doc };
    if (result.doc === doc) return { ok: true, doc, etag: stored?.etag ?? null };
    try {
      const etag = await client.putDoc(projectId, kind, result.doc, stored?.etag ?? null);
      return { ok: true, doc: result.doc, etag };
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 412) throw error;
      conflict = error;
    }
  }
  throw conflict ?? new ApiError(412, 'precondition_failed', 'No attempts available.');
}
