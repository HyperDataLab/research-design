import { useEffect, useRef, useState } from 'react';
import type { Draft } from '@/core/draft/schema';
import { factsDocSchema, type FactsDoc } from '@/core/facts/factsDoc';
import { emptyPapersDoc, papersDocSchema, type Paper } from '@/core/papers/papers';
import { buildSuggestionRequest, readSuggestions } from '@/core/suggest/suggest';
import { useApi } from '@/shared/api/apiContext';
import { ApiError } from '@/shared/api/client';
import { useProject } from '@/shared/project/projectContext';

type Target = 'hypotheses' | 'metrics' | 'threats';
type State = 'idle' | 'sending' | 'done' | 'failed' | 'unreadable';
export function useSuggestions(target: Target, draft: Draft) {
  const client = useApi();
  const { project } = useProject();
  const [data, setData] = useState<{ papers: Paper[]; facts: Record<string, FactsDoc | undefined> } | null>(
    null,
  );
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<{ text: string; cites: string[] }[]>([]);
  const [droppedCites, setDroppedCites] = useState(0);
  const sending = useRef(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const stored = await client.getDoc(project.id, 'papers');
        const papers = papersDocSchema
          .parse(stored?.data ?? emptyPapersDoc())
          .papers.filter((p) => p.decision === 'included');
        const entries = await Promise.all(
          papers.map(async (paper) => {
            const item = await client.getItem(project.id, 'facts', paper.id);
            return [paper.id, item ? factsDocSchema.parse(item.data) : undefined] as const;
          }),
        );
        if (active) setData({ papers, facts: Object.fromEntries(entries) });
      } catch {
        if (active) {
          setError('network');
          setState('failed');
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [client, project.id]);
  const factCount = data
    ? data.papers.reduce(
        (n, p) =>
          n +
          (data.facts[p.id]?.facts.facts.filter((f) => data.facts[p.id]?.decisions[f.id]?.decision === 'use')
            .length ?? 0),
        0,
      )
    : 0;
  const citations = Object.fromEntries(
    (data?.papers ?? []).flatMap((p) =>
      (data?.facts[p.id]?.facts.facts ?? [])
        .filter((f) => data?.facts[p.id]?.decisions[f.id]?.decision === 'use')
        .map((f) => [p.id + '/' + f.id, f.value + ' · ' + p.title]),
    ),
  );
  async function send() {
    if (!data || !factCount || sending.current) return;
    sending.current = true;
    setState('sending');
    setError('');
    try {
      const { request, allow } = buildSuggestionRequest({
        projectId: project.id,
        target,
        papers: data.papers,
        factsByPaperId: data.facts,
        draft,
      });
      if (!request) {
        setState('idle');
        return;
      }
      const answer = await client.chat(request);
      const result = readSuggestions(answer.content, allow);
      if (!result.ok) {
        setState('unreadable');
        return;
      }
      setSuggestions(result.suggestions);
      setDroppedCites(result.droppedCites);
      setState('done');
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'network');
      setState('failed');
    } finally {
      sending.current = false;
    }
  }
  return {
    factCount,
    send,
    state,
    suggestions,
    droppedCites,
    citations,
    error,
    loading: !data && state !== 'failed',
  };
}
