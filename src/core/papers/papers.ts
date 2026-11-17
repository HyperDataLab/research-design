import { z } from 'zod';
import type { PaperModelView } from './paperModel';

export function normaliseDoi(input: string): string | null {
  const doi = input
    .trim()
    .replace(/^(?:https:\/\/doi\.org\/|http:\/\/dx\.doi\.org\/|doi:\s*)/i, '')
    .toLowerCase();
  return /^10\.\d{4,9}\/\S+$/.test(doi) ? doi : null;
}
const idSchema = z.string().regex(/^p-[0-9a-f]{12}$/);
const timestamp = z.iso.datetime();
const reason = z.string().trim().min(1).nullable();
const decisionSchema = z.enum(['undecided', 'included', 'excluded']);
const modelSchema = z.strictObject({
  paperlab: z.strictObject({ paperId: z.string(), etag: z.string() }).nullable().default(null),
  sourceHash: z.string().nullable(),
  sentences: z.number().int().nonnegative(),
  importedBy: z.string(),
  importedAt: timestamp,
});
const paperSchema = z
  .strictObject({
    id: idSchema,
    title: z.string().trim().min(1).max(500),
    authors: z.array(z.string()),
    year: z.number().int().min(1500).max(2100).nullable(),
    venue: z.string().nullable(),
    doi: z
      .string()
      .refine((value) => normaliseDoi(value) === value)
      .nullable(),
    decision: decisionSchema,
    reason,
    addedBy: z.string(),
    addedAt: timestamp,
    model: modelSchema.nullable(),
  })
  .refine((paper) => (paper.decision === 'excluded') === (paper.reason !== null));
const logSchema = z.strictObject({
  at: timestamp,
  by: z.string(),
  paperId: idSchema,
  action: z.enum(['added', 'included', 'excluded', 'undecided', 'model_imported']),
  reason,
});
export const papersDocSchema = z.strictObject({
  schemaVersion: z.literal(1),
  papers: z.array(paperSchema),
  log: z.array(logSchema),
});
export type PapersDoc = z.infer<typeof papersDocSchema>;
export type Paper = PapersDoc['papers'][number];
export type PaperInput = Pick<Paper, 'title' | 'authors' | 'year' | 'venue' | 'doi'>;
export type PaperError =
  'duplicate_doi' | 'invalid_doi' | 'invalid_title' | 'unknown_paper' | 'reason_required';
type Result = { ok: true; doc: PapersDoc } | { ok: false; error: PaperError };
export const emptyPapersDoc = (): PapersDoc => ({ schemaVersion: 1, papers: [], log: [] });
export function newPaperId(bytes: Uint8Array): string {
  if (bytes.length !== 6) throw new Error('Expected six random bytes');
  return 'p-' + Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export function addPaper(doc: PapersDoc, input: PaperInput, who: string, at: string, id: string): Result {
  const title = input.title.trim();
  if (!title || title.length > 500) return { ok: false, error: 'invalid_title' };
  const doi = input.doi?.trim() ? normaliseDoi(input.doi) : null;
  if (input.doi?.trim() && !doi) return { ok: false, error: 'invalid_doi' };
  if (doi && doc.papers.some((paper) => paper.doi === doi)) return { ok: false, error: 'duplicate_doi' };
  const paper: Paper = {
    ...input,
    authors: [...input.authors],
    id,
    title,
    doi,
    decision: 'undecided',
    reason: null,
    addedBy: who,
    addedAt: at,
    model: null,
  };
  return {
    ok: true,
    doc: {
      ...doc,
      papers: [...doc.papers, paper],
      log: [...doc.log, { at, by: who, paperId: id, action: 'added', reason: null }],
    },
  };
}
export function decide(
  doc: PapersDoc,
  paperId: string,
  decision: Paper['decision'],
  inputReason: string | null,
  who: string,
  at: string,
): Result {
  const paper = doc.papers.find((entry) => entry.id === paperId);
  if (!paper) return { ok: false, error: 'unknown_paper' };
  const reason = decision === 'excluded' ? inputReason?.trim() || null : null;
  if (decision === 'excluded' && !reason) return { ok: false, error: 'reason_required' };
  if (paper.decision === decision && paper.reason === reason) return { ok: true, doc };
  return {
    ok: true,
    doc: {
      ...doc,
      papers: doc.papers.map((entry) => (entry.id === paperId ? { ...entry, decision, reason } : entry)),
      log: [...doc.log, { at, by: who, paperId, action: decision, reason }],
    },
  };
}
export function attachModel(
  doc: PapersDoc,
  paperId: string,
  model: Omit<NonNullable<Paper['model']>, 'paperlab'> & {
    paperlab?: NonNullable<Paper['model']>['paperlab'];
  },
  who: string,
  at: string,
): Result {
  if (!doc.papers.some((paper) => paper.id === paperId)) return { ok: false, error: 'unknown_paper' };
  return {
    ok: true,
    doc: {
      ...doc,
      papers: doc.papers.map((paper) =>
        paper.id === paperId ? { ...paper, model: { ...model, paperlab: model.paperlab ?? null } } : paper,
      ),
      log: [...doc.log, { at, by: who, paperId, action: 'model_imported', reason: null }],
    },
  };
}
export function matchPaper(doc: PapersDoc, model: PaperModelView): Paper | undefined {
  const doi = model.document.metadata.doi && normaliseDoi(model.document.metadata.doi);
  const hash = model.document.source.sha256;
  return (
    (doi ? doc.papers.find((paper) => paper.doi === doi) : undefined) ??
    (hash !== null ? doc.papers.find((paper) => paper.model?.sourceHash === hash) : undefined)
  );
}
export function paperFromModel(model: PaperModelView): PaperInput {
  const { title, authors, year, venue, doi } = model.document.metadata;
  return { title, authors: [...authors], year, venue, doi };
}
