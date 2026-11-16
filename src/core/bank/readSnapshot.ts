import { SNAPSHOT_FORMAT, SNAPSHOT_FORMAT_VERSION, snapshotFileSchema, type BankDoc } from './snapshot';
import type { z } from 'zod';

type SnapshotFile = z.infer<typeof snapshotFileSchema>;
export function readSnapshot(
  data: unknown,
):
  | { ok: true; file: SnapshotFile }
  | { ok: false; reason: 'not_a_snapshot' | 'unsupported_version' | 'invalid'; issues: string[] } {
  if (!data || typeof data !== 'object' || !('format' in data) || data.format !== SNAPSHOT_FORMAT)
    return { ok: false, reason: 'not_a_snapshot', issues: [] };
  if (!('formatVersion' in data) || data.formatVersion !== SNAPSHOT_FORMAT_VERSION)
    return { ok: false, reason: 'unsupported_version', issues: [] };
  const parsed = snapshotFileSchema.safeParse(data);
  return parsed.success
    ? { ok: true, file: parsed.data }
    : {
        ok: false,
        reason: 'invalid',
        issues: parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      };
}
export function toBankDoc(file: SnapshotFile, release: string, who: string, at: string): BankDoc {
  return {
    schemaVersion: 1,
    release,
    source: file.source,
    importedBy: who,
    importedAt: at,
    collections: file.collections,
  };
}
export const findDesign = (bank: BankDoc | null, id: string) =>
  bank?.collections.designs.find((x) => x.id === id);
export const findThreat = (bank: BankDoc | null, id: string) =>
  bank?.collections.threats.find((x) => x.id === id);
export const findClaimType = (bank: BankDoc | null, id: string) =>
  bank?.collections['claim-types'].find((x) => x.id === id);
