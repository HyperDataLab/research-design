import { useCallback, useEffect, useState } from 'react';
import { version as appVersion } from '../../../package.json';
import { freezeGate, nextVersion, type Gate } from '@/core/draft/freezeGate';
import { draftSchema, emptyDraft } from '@/core/draft/schema';
import { emptyPapersDoc, papersDocSchema } from '@/core/papers/papers';
import type { ExperimentPlan } from '@/core/plan/schema';
import { ApiError } from '@/shared/api/client';
import { useApi } from '@/shared/api/apiContext';
import { useAuth } from '@/shared/auth/authContext';
import { useProject } from '@/shared/project/projectContext';

type Version = { version: number; frozenAt: string; frozenBy: string };
export type FreezeResult =
  | { ok: true; plan: ExperimentPlan }
  | { ok: false; reason: 'not_a_plan' | 'blocked' | 'unchanged'; gate: Gate }
  | { ok: false; reason: 'conflict' | 'error' };
export function usePlans() {
  const api = useApi();
  const { project } = useProject();
  const { user } = useAuth();
  const [versions, setVersions] = useState<Version[]>([]);
  const [latest, setLatest] = useState<ExperimentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      if (!api.listPlans || !api.getPlan) throw new Error('Plans API unavailable');
      const list = await api.listPlans(project.id);
      const number = Math.max(0, ...list.map((v) => v.version));
      const plan = number ? await api.getPlan(project.id, number) : null;
      setVersions(list);
      setLatest(plan);
      return { list, plan };
    } catch (cause) {
      setError(true);
      throw cause;
    } finally {
      setLoading(false);
    }
  }, [api, project.id]);
  useEffect(() => {
    void Promise.resolve()
      .then(reload)
      .catch(() => {});
  }, [reload]);
  const freeze = async (draftMeta: { deviation: string | null }): Promise<FreezeResult> => {
    try {
      if (!user?.email) return { ok: false, reason: 'error' };
      const [storedDraft, storedPapers, current] = await Promise.all([
        api.getDoc(project.id, 'draft'),
        api.getDoc(project.id, 'papers'),
        reload(),
      ]);
      const draft = draftSchema.parse(storedDraft?.data ?? emptyDraft());
      const papers = papersDocSchema.parse(storedPapers?.data ?? emptyPapersDoc());
      const gate = freezeGate(
        draft,
        {
          planId: project.id,
          planVersion: nextVersion(current.list.map((v) => v.version)),
          title: draft.planTitle || project.title,
          frozenAt: new Date().toISOString(),
          frozenBy: user.email,
          deviation: draftMeta.deviation,
          appVersion,
        },
        papers,
        current.plan,
      );
      if (gate.state === 'not_a_plan') return { ok: false, reason: 'not_a_plan', gate };
      if (gate.unchanged) return { ok: false, reason: 'unchanged', gate };
      if (gate.blocked) return { ok: false, reason: 'blocked', gate };
      if (!api.freezePlan) throw new Error('Plans API unavailable');
      const plan = await api.freezePlan(project.id, gate.plan);
      setLatest(plan);
      setVersions((old) => [
        ...old,
        { version: plan.planVersion, frozenAt: plan.frozenAt, frozenBy: plan.frozenBy },
      ]);
      return { ok: true, plan };
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        await reload().catch(() => {});
        return { ok: false, reason: 'conflict' };
      }
      return { ok: false, reason: 'error' };
    }
  };
  return { versions, latest, loading, error, reload, freeze };
}
