import { useCallback, useEffect, useState } from 'react';
import {
  addPaper,
  attachModel,
  decide as decidePaper,
  emptyPapersDoc,
  matchPaper,
  newPaperId,
  paperFromModel,
  papersDocSchema,
  type Paper,
  type PaperInput,
  type PapersDoc,
} from '@/core/papers/papers';
import { readPaperModel } from '@/core/papers/paperModel';
import { updateDoc } from '@/shared/api/updateDoc';
import { useApi } from '@/shared/api/apiContext';
import { useAuth } from '@/shared/auth/authContext';
import { useProject } from '@/shared/project/projectContext';

export function useCorpus() {
  const client = useApi();
  const { user } = useAuth();
  const { project } = useProject();
  const [doc, setDoc] = useState<PapersDoc>(emptyPapersDoc);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const stored = await client.getDoc(project.id, 'papers');
      setDoc(papersDocSchema.parse(stored?.data ?? emptyPapersDoc()));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [client, project.id]);
  useEffect(() => {
    void Promise.resolve().then(reload);
  }, [reload]);
  const write = async (change: (current: PapersDoc) => ReturnType<typeof addPaper>) => {
    try {
      const result = await updateDoc({
        client,
        projectId: project.id,
        kind: 'papers',
        schema: papersDocSchema,
        empty: emptyPapersDoc,
        change,
      });
      setDoc(result.doc);
      return result;
    } catch {
      return { ok: false as const, error: 'network' as const };
    }
  };
  const add = (input: PaperInput) => {
    const id = newPaperId(crypto.getRandomValues(new Uint8Array(6)));
    const who = user?.email ?? '';
    const at = new Date().toISOString();
    return write((current) => addPaper(current, input, who, at, id));
  };
  const decide = (id: string, decision: Paper['decision'], reason: string | null) => {
    const who = user?.email ?? '';
    const at = new Date().toISOString();
    return write((current) => decidePaper(current, id, decision, reason, who, at));
  };
  const importModel = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) return { ok: false as const, error: 'too_large' as const };
    let data: unknown;
    try {
      data = JSON.parse(await file.text()) as unknown;
    } catch {
      return { ok: false as const, error: 'not_json' as const };
    }
    const parsed = readPaperModel(data);
    if (!parsed.ok) return { ok: false as const, error: parsed.reason, issues: parsed.issues };
    const model = parsed.model;
    const who = user?.email ?? '';
    const at = new Date().toISOString();
    const metadata = {
      sourceHash: model.document.source.sha256,
      sentences: model.sentences.length,
      importedBy: who,
      importedAt: at,
    };
    try {
      const stored = await client.getDoc(project.id, 'papers');
      const current = papersDocSchema.parse(stored?.data ?? emptyPapersDoc());
      const existing = matchPaper(current, model);
      let id = existing?.id ?? newPaperId(crypto.getRandomValues(new Uint8Array(6)));
      let created = !existing;
      const putModel = async (key: string) => {
        const item = await client.getItem(project.id, 'paper-models', key);
        await client.putItem(project.id, 'paper-models', key, data, item?.etag ?? null);
      };
      await putModel(id);
      let result = await write((d) => {
        if (!created) return attachModel(d, id, metadata, who, at);
        const added = addPaper(d, paperFromModel(model), who, at, id);
        return added.ok ? attachModel(added.doc, id, metadata, who, at) : added;
      });
      if (!result.ok && result.error === 'duplicate_doi' && 'doc' in result) {
        const match = matchPaper(result.doc, model);
        if (match) {
          id = match.id;
          created = false;
          await putModel(id);
          result = await write((d) => attachModel(d, id, metadata, who, at));
        }
      }
      if (!result.ok) return result;
      const paper = result.doc.papers.find((p) => p.id === id);
      if (!paper) return { ok: false as const, error: 'network' as const };
      return { ok: true as const, paper, created };
    } catch {
      return { ok: false as const, error: 'network' as const };
    }
  };
  return { doc, loading, error, reload, add, decide, importModel };
}
