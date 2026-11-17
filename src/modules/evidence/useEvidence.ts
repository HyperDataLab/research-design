import { useCallback, useEffect, useState } from 'react';
import {
  clearDecision,
  clearMatch,
  confirmMatch,
  decide,
  factsDocSchema,
  type FactsDoc,
} from '@/core/facts/factsDoc';
import type { BankDoc } from '@/core/bank/snapshot';
import { emptyPapersDoc, papersDocSchema, type Paper } from '@/core/papers/papers';
import { readPaperModel, type PaperModelView } from '@/core/papers/paperModel';
import { ApiError } from '@/shared/api/client';
import { useApi } from '@/shared/api/apiContext';
import { useAuth } from '@/shared/auth/authContext';
import { useProject } from '@/shared/project/projectContext';

type Item = { doc: FactsDoc; etag: string };
export type Selection = { paperId: string; factId: string };
export function useEvidence(bank: BankDoc | null) {
  const client = useApi();
  const { project, readOnly } = useProject();
  const { user } = useAuth();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [items, setItems] = useState<Record<string, Item>>({});
  const [models, setModels] = useState<Record<string, PaperModelView>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const stored = await client.getDoc(project.id, 'papers');
      const included = papersDocSchema
        .parse(stored?.data ?? emptyPapersDoc())
        .papers.filter((p) => p.decision === 'included');
      const entries = await Promise.all(
        included.map(async (p) => {
          const item = await client.getItem(project.id, 'facts', p.id);
          return item ? ([p.id, { doc: factsDocSchema.parse(item.data), etag: item.etag }] as const) : null;
        }),
      );
      setPapers(included);
      setItems(Object.fromEntries(entries.filter((entry) => entry !== null)));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [client, project.id]);
  useEffect(() => {
    void Promise.resolve().then(reload);
  }, [reload]);
  const loadModel = async (paperId: string) => {
    if (models[paperId]) return models[paperId];
    const item = await client.getItem(project.id, 'paper-models', paperId);
    const parsed = item && readPaperModel(item.data);
    if (!parsed || !parsed.ok) throw new Error('Missing paper model');
    setModels((current) => ({ ...current, [paperId]: parsed.model }));
    return parsed.model;
  };
  const write = async (
    id: string,
    initial: Item,
    apply: (doc: FactsDoc) => { ok: true; doc: FactsDoc } | { ok: false; error: string },
  ) => {
    let item = initial;
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = apply(item.doc);
      if (!result.ok) return result;
      try {
        const etag = await client.putItem(project.id, 'facts', id, result.doc, item.etag);
        setItems((current) => ({ ...current, [id]: { doc: result.doc, etag } }));
        return { ok: true as const };
      } catch (caught) {
        if (!(caught instanceof ApiError) || caught.status !== 412) throw caught;
        if (attempt === 1) return { ok: false as const, error: 'conflict' };
        const fresh = await client.getItem(project.id, 'facts', id);
        if (!fresh) return { ok: false as const, error: 'conflict' };
        item = { doc: factsDocSchema.parse(fresh.data), etag: fresh.etag };
      }
    }
    return { ok: false as const, error: 'conflict' };
  };
  const change = async (
    selected: Selection[],
    action: 'use' | 'exclude' | 'clear',
    reason: string | null,
  ) => {
    if (readOnly) return { ok: false as const, error: 'network' };
    try {
      const groups = new Map<string, Selection[]>();
      for (const entry of selected) groups.set(entry.paperId, [...(groups.get(entry.paperId) ?? []), entry]);
      const at = new Date().toISOString();
      const prepared: { id: string; ids: string[]; item: Item; model: PaperModelView }[] = [];
      for (const [id, entries] of groups) {
        const item = items[id];
        if (!item) throw new Error('Missing facts');
        const model = await loadModel(id);
        const ids = entries.map((entry) => entry.factId);
        const result =
          action === 'clear'
            ? clearDecision(item.doc, ids)
            : decide(item.doc, ids, action, reason, user?.email ?? '', at, model);
        if (!result.ok) return result;
        prepared.push({ id, ids, item, model });
      }
      for (const entry of prepared) {
        const result = await write(entry.id, entry.item, (doc) =>
          action === 'clear'
            ? clearDecision(doc, entry.ids)
            : decide(doc, entry.ids, action, reason, user?.email ?? '', at, entry.model),
        );
        if (!result.ok) return result;
      }
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: 'network' };
    }
  };
  const match = async (paperId: string, factId: string, bankId: string | null) => {
    if (readOnly || !items[paperId]) return { ok: false as const, error: 'network' };
    const at = new Date().toISOString();
    try {
      return await write(paperId, items[paperId], (doc) =>
        bankId === null
          ? { ok: true, doc: clearMatch(doc, factId) }
          : confirmMatch(doc, factId, bankId, bank, user?.email ?? '', at),
      );
    } catch {
      return { ok: false as const, error: 'network' };
    }
  };
  return { papers, items, models, loading, error, reload, loadModel, change, match };
}
