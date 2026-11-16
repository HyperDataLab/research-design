import { PLAN_FORMAT, PLAN_SCHEMA_VERSION, planSchema, type ExperimentPlan } from '../plan/schema';
import { runCount, type Draft } from './schema';
import type { PapersDoc } from '../papers/papers';

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
  papers?: PapersDoc,
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
    context: {
      questions: draft.questions.map((q) => ({
        id: q.id,
        text: q.text,
        gap: q.gap || null,
        hypotheses: draft.hypotheses.filter((h) => h.question === q.id).map((h) => h.id),
      })),
      design: draft.design,
      threats: draft.threats.map(({ name, mitigation, bank }) => ({ name, mitigation, bank })),
      sources: (papers?.papers ?? [])
        .filter((p) => p.decision === 'included')
        .map((p) => ({ title: p.title, doi: p.doi, sourceHash: p.model?.sourceHash ?? null })),
      claims: draft.hypotheses.flatMap((h) => (h.claim ? [{ hypothesis: h.id, claimType: h.claim }] : [])),
      constructs: draft.variables.flatMap((v) =>
        v.construct ? [{ variable: v.id, construct: v.construct }] : [],
      ),
      metricProtocols: draft.metrics.flatMap((m) =>
        m.protocolBank ? [{ metric: m.id, protocol: m.protocolBank }] : [],
      ),
    },
  };
  const parsed = planSchema.safeParse(candidate);
  return parsed.success
    ? { ok: true, plan: parsed.data }
    : {
        ok: false,
        issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      };
}
