import { z } from 'zod';
import vendoredSchema from '../../../schemas/vendor/experiment-facts-v1.schema.json';

export type FactKind = 'task' | 'dataset' | 'baseline' | 'method' | 'metric' | 'design' | 'sample' | 'result';
export interface ExperimentFact {
  id: string;
  kind: FactKind;
  value: string;
  number: number | null;
  unit: string | null;
  uncertainty: string | null;
  condition: string | null;
  metric: string | null;
  dataset: string | null;
  system: string | null;
  sentenceKeys: string[];
  tableCell: {
    blockId: string;
    row: number;
    column: number;
    rowHeader: string | null;
    columnHeader: string | null;
  } | null;
  status: 'candidate' | 'accepted';
}
export interface ExperimentFactsView {
  format: 'paperlab-experiment-facts';
  schemaVersion: 1;
  paperId: string;
  modelEtag: string;
  generatedAt: string;
  run: { id: string; promptVersion: string; model: string; at: string };
  facts: ExperimentFact[];
}
export type ExperimentFactsResult =
  | { ok: true; facts: ExperimentFactsView }
  | { ok: false; reason: 'not_experiment_facts' | 'unsupported_version' | 'invalid'; issues: string[] };

let validator: z.ZodType | undefined;
export function readExperimentFacts(input: unknown): ExperimentFactsResult {
  const head = z.looseObject({ format: z.unknown(), schemaVersion: z.unknown() }).safeParse(input);
  if (!head.success || head.data.format !== 'paperlab-experiment-facts')
    return { ok: false, reason: 'not_experiment_facts', issues: [] };
  if (head.data.schemaVersion !== 1)
    return {
      ok: false,
      reason: 'unsupported_version',
      issues: [`schemaVersion ${String(head.data.schemaVersion)}`],
    };
  validator ??= z.fromJSONSchema(vendoredSchema as Parameters<typeof z.fromJSONSchema>[0]);
  const parsed = validator.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      reason: 'invalid',
      issues: parsed.error.issues.slice(0, 20).map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    };
  const facts = input as ExperimentFactsView;
  const missing = facts.facts.findIndex((fact) => fact.sentenceKeys.length === 0 && fact.tableCell === null);
  if (missing !== -1) return { ok: false, reason: 'invalid', issues: [`facts.${missing}: anchor required`] };
  return { ok: true, facts };
}
