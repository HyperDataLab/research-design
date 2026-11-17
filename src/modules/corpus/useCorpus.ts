import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { factsDocSchema, replaceFacts } from '@/core/facts/factsDoc';
import { readExperimentFacts } from '@/core/facts/experimentFacts';
import { ApiError } from '@/shared/api/client';
import { paperlabUrl } from '@/shared/auth/config';
import { createPaperLabClient } from '@/shared/paperlab/client';
import { readPaperModel } from '@/core/papers/paperModel';
import { updateDoc } from '@/shared/api/updateDoc';
import { useApi } from '@/shared/api/apiContext';
import { useAuth } from '@/shared/auth/authContext';
import { useProject } from '@/shared/project/projectContext';

export function useCorpus() {
  const client = useApi();
  const { user, getIdToken } = useAuth();
  const paperlab = useMemo(
    () => (paperlabUrl ? createPaperLabClient({ baseUrl: paperlabUrl, getToken: getIdToken }) : null),
    [getIdToken],
  );
  const [factsIds, setFactsIds] = useState<string[]>([]);
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
      if (paperlab) setFactsIds((await client.listItems(project.id, 'facts')).map((item) => item.key));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [client, project.id, paperlab]);
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
    return saveModel(data, null);
  };
  const saveModel = async (data: unknown, paperlabSource: { paperId: string; etag: string } | null) => {
    if (new TextEncoder().encode(JSON.stringify(data)).length > 8 * 1024 * 1024)
      return { ok: false as const, error: 'too_large' as const };
    const parsed = readPaperModel(data);
    if (!parsed.ok) return { ok: false as const, error: parsed.reason, issues: parsed.issues };
    const model = parsed.model;
    const who = user?.email ?? '';
    const at = new Date().toISOString();
    const metadata = {
      paperlab: paperlabSource,
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
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof ApiError && error.status === 413 ? ('too_large' as const) : ('network' as const),
      };
    }
  };
  const importPaperLab = async (paperId: string) => {
    try {
      if (!paperlab) throw new Error('PaperLab unavailable');
      const model = await paperlab.getModel(paperId);
      return await saveModel(model.data, { paperId, etag: model.etag });
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof ApiError && error.status === 413 ? ('too_large' as const) : ('network' as const),
      };
    }
  };
  const fetchFacts = async (paper: Paper) => {
    try {
      if (!paperlab || !paper.model?.paperlab) throw new Error('PaperLab unavailable');
      const paperlabId = paper.model.paperlab.paperId;
      const result = await paperlab.getFacts(paperlabId);
      if (!result) return { ok: false as const, error: 'not_found' };
      const parsed = readExperimentFacts(result.data);
      if (!parsed.ok) return { ok: false as const, error: parsed.reason, issues: parsed.issues };
      const source = {
        paperlabId,
        etag: result.etag,
        fetchedBy: user?.email ?? '',
        fetchedAt: new Date().toISOString(),
      };
      for (let attempt = 0; attempt < 4; attempt++) {
        const existing = await client.getItem(project.id, 'facts', paper.id);
        const replacement = existing
          ? replaceFacts(factsDocSchema.parse(existing.data), parsed.facts, source)
          : null;
        const doc =
          replacement?.doc ??
          factsDocSchema.parse({
            schemaVersion: 1,
            paperId: paper.id,
            source,
            facts: parsed.facts,
            decisions: {},
          });
        try {
          await client.putItem(project.id, 'facts', paper.id, doc, existing?.etag ?? null);
          setFactsIds((ids) => (ids.includes(paper.id) ? ids : [...ids, paper.id]));
          return { ok: true as const, dropped: replacement?.dropped.length ?? 0 };
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 412 || attempt === 3) throw error;
        }
      }
      throw new Error('Conflict');
    } catch {
      return { ok: false as const, error: 'network' };
    }
  };
  return {
    doc,
    loading,
    error,
    reload,
    add,
    decide,
    importModel,
    paperlab,
    importPaperLab,
    fetchFacts,
    factsIds,
  };
}
