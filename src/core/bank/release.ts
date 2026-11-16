import { readSnapshot } from './readSnapshot';

async function hash(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Hash the original collections and aliases, before schema parsing removes any fields. */
export async function contentHash(data: { collections: unknown; aliases?: unknown }): Promise<string> {
  return hash(
    new TextEncoder().encode(JSON.stringify({ collections: data.collections, aliases: data.aliases })),
  );
}

export async function snapshotRelease(data: unknown, bytes: ArrayBuffer) {
  const parsed = readSnapshot(data);
  if (!parsed.ok) return parsed;
  if (parsed.file.release !== undefined) {
    const raw = data as { collections: unknown; aliases?: unknown };
    const computed = await contentHash(raw);
    if (parsed.file.contentHash !== computed)
      return { ok: false as const, reason: 'hash_mismatch' as const, issues: [] };
    return { ok: true as const, file: parsed.file, release: parsed.file.release };
  }
  return { ok: true as const, file: parsed.file, release: `sha256:${(await hash(bytes)).slice(0, 16)}` };
}
