import { useCallback, useEffect, useState } from 'react';
import { readSnapshot, toBankDoc } from '@/core/bank/readSnapshot';
import { bankDocSchema, type BankDoc } from '@/core/bank/snapshot';
import { useApi } from '@/shared/api/apiContext';
import { ApiError } from '@/shared/api/client';
import { useAuth } from '@/shared/auth/authContext';
import { useProject } from '@/shared/project/projectContext';

export function useBank() {
  const client = useApi();
  const { project } = useProject();
  const { user } = useAuth();
  const [bank, setBank] = useState<BankDoc | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const stored = await client.getDoc(project.id, 'bank');
      setBank(stored ? bankDocSchema.parse(stored.data) : null);
      setEtag(stored?.etag ?? null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [client, project.id]);
  useEffect(() => {
    void Promise.resolve().then(reload);
  }, [reload]);
  const importSnapshot = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) return { ok: false as const, error: 'too_large' as const };
    let bytes: ArrayBuffer;
    let data: unknown;
    try {
      bytes = await file.arrayBuffer();
      data = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      return { ok: false as const, error: 'not_json' as const };
    }
    const parsed = readSnapshot(data);
    if (!parsed.ok) return { ok: false as const, error: parsed.reason, issues: parsed.issues };
    try {
      const hash = await crypto.subtle.digest('SHA-256', bytes);
      const release =
        'sha256:' +
        Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0'))
          .join('')
          .slice(0, 16);
      const doc = toBankDoc(parsed.file, release, user?.email ?? '', new Date().toISOString());
      const next = await client.putDoc(project.id, 'bank', doc, etag);
      setBank(doc);
      setEtag(next);
      return { ok: true as const };
    } catch (e) {
      if (e instanceof ApiError && e.status === 412) {
        await reload();
        return { ok: false as const, error: 'conflict' as const };
      }
      return { ok: false as const, error: 'network' as const };
    }
  };
  return { bank, loading, error, reload, importSnapshot };
}
