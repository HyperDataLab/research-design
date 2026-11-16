import { useCallback, useEffect, useState } from 'react';
import { draftSchema, emptyDraft, type Draft } from '@/core/draft/schema';
import type { DraftResult } from '@/core/draft/ops';
import { useApi } from '@/shared/api/apiContext';
import { updateDoc } from '@/shared/api/updateDoc';
import { useProject } from '@/shared/project/projectContext';

export function useDraft() {
  const client = useApi();
  const { project } = useProject();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const stored = await client.getDoc(project.id, 'draft');
      setDraft(draftSchema.parse(stored?.data ?? emptyDraft()));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [client, project.id]);
  useEffect(() => {
    void Promise.resolve().then(reload);
  }, [reload]);
  const change = async (fn: (draft: Draft) => DraftResult) => {
    try {
      const result = await updateDoc({
        client,
        projectId: project.id,
        kind: 'draft',
        schema: draftSchema,
        empty: emptyDraft,
        change: fn,
      });
      setDraft(result.doc);
      return result;
    } catch {
      return { ok: false as const, error: 'network' as const };
    }
  };
  return { draft, loading, error, reload, change };
}
