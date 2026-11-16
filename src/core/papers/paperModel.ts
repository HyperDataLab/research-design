import { z } from 'zod';
import vendoredSchema from '../../../schemas/vendor/paper-model-v1.schema.json';

/**
 * Reading PaperLab's paper model. PaperLab owns the contract; the validator is built from the vendored JSON
 * Schema itself, so this app checks exactly what PaperLab publishes and nothing here restates it.
 */
export const PAPER_MODEL_FORMAT = 'paperlab-paper-model';
export const PAPER_MODEL_VERSION = 1;

/** The parts of a paper model this app reads. Everything else is kept as it came and never interpreted. */
export interface PaperModelView {
  format: typeof PAPER_MODEL_FORMAT;
  schemaVersion: typeof PAPER_MODEL_VERSION;
  document: {
    source: { kind: string; sha256: string | null; pageCount: number | null };
    metadata: {
      title: string;
      authors: string[];
      doi: string | null;
      year: number | null;
      venue: string | null;
    };
    sections: { id: string; parentId: string | null; title: string; level: number; role: string }[];
  };
  sentences: { key: string; displayId: string; sectionId: string; page: number | null; text: string }[];
}

export type PaperModelResult =
  | { ok: true; model: PaperModelView }
  | { ok: false; reason: 'not_a_paper_model' | 'unsupported_version' | 'invalid'; issues: string[] };

let validator: z.ZodType | undefined;

export function readPaperModel(input: unknown): PaperModelResult {
  const head = z.looseObject({ format: z.unknown(), schemaVersion: z.unknown() }).safeParse(input);
  // The two cheap checks come first so the refusal is one sentence, not a list of schema errors.
  if (!head.success || head.data.format !== PAPER_MODEL_FORMAT)
    return { ok: false, reason: 'not_a_paper_model', issues: [] };
  if (head.data.schemaVersion !== PAPER_MODEL_VERSION)
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
  return { ok: true, model: input as PaperModelView };
}
