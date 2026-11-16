import { PLAN_FORMAT, PLAN_SCHEMA_VERSION, planSchema, type ExperimentPlan } from '../plan/schema';
import { runCount, type Draft } from './schema';

export function draftToPlan(
  draft: Draft,
  meta: {
    planId: string;
    planVersion: number;
    title: string;
    frozenAt: string;
    frozenBy: string;
    deviation: string | null;
    appVersion: string;
  },
): { ok: true; plan: ExperimentPlan } | { ok: false; issues: string[] } {
  const { appVersion, ...metadata } = meta;
  const candidate = {
    format: PLAN_FORMAT,
    schemaVersion: PLAN_SCHEMA_VERSION,
    ...metadata,
    generator: { app: 'research-design', version: appVersion },
    hypotheses: draft.hypotheses.map(({ question, claim, ...h }) => {
      void question;
      void claim;
      return h;
    }),
    variables: draft.variables.map(({ construct, ...v }) => {
      void construct;
      return v;
    }),
    metrics: draft.metrics.map(({ protocolBank, ...m }) => {
      void protocolBank;
      return m;
    }),
    datasets: draft.datasets,
    conditions: draft.conditions,
    runMatrix: { ...draft.runMatrix, expectedRuns: runCount(draft.runMatrix) },
    analyses: draft.analyses,
    context: null,
  };
  const parsed = planSchema.safeParse(candidate);
  return parsed.success
    ? { ok: true, plan: parsed.data }
    : {
        ok: false,
        issues: parsed.error.issues.slice(0, 10).map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      };
}
