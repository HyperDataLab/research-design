import { z } from 'zod';
import { bankRef, hypothesisId, hypothesisSchema, variableId } from '../plan/schema';

/**
 * The editable plan of a project, stored as the `draft` document. It is looser than the frozen plan
 * (`../plan/schema.ts`): lists may be empty and links may be missing while the person is still working.
 * Gói kế hoạch (S10) builds the frozen plan from it. A slice that adds a part of the plan adds its field here
 * with a default, so drafts written earlier still parse.
 */
export const DRAFT_SCHEMA_VERSION = 1;

const text = z.string().trim().min(1);
const localId = (prefix: string) => z.string().regex(new RegExp(`^${prefix}-[1-9][0-9]*$`));
export const questionId = localId('q');
export const threatId = localId('t');
const paperId = z.string().regex(/^p-[0-9a-f]{12}$/);

/** The claim types of Writing Bank (`ct.causal`, `ct.comparative`, …). What a design supports is stated in these. */
export const claimTypeId = z.string().regex(/^ct\.[a-z0-9-]+$/);

export const draftQuestionSchema = z.strictObject({
  id: questionId,
  text,
  /** The gap in earlier work this question answers, in the person's words. Empty until written. */
  gap: z.string().trim(),
  /** Papers of the project (Tập bài báo) the gap was read from. */
  papers: z.array(paperId),
});

export const draftHypothesisSchema = z.strictObject({
  id: hypothesisId.and(localId('h')),
  statement: text,
  kind: hypothesisSchema.shape.kind,
  /** The question this hypothesis answers. */
  question: questionId.nullable(),
  /**
   * What kind of claim confirming the hypothesis would make, chosen by the person from the bank's claim types.
   * A design is checked against it (DS-01). It lives in the draft only: the frozen plan has no field for it
   * yet (see PRD D26).
   */
  claim: claimTypeId.nullable(),
  /** Filled on Đo lường (S8). */
  independent: z.array(variableId),
  dependent: z.array(variableId),
});

export const draftDesignSchema = z.strictObject({
  name: text,
  /**
   * How units reach the conditions in this study. The bank says `either` for some designs; the person then
   * chooses, and until they do this is null (DS-03).
   */
  assignment: z.enum(['random', 'non_random', 'none']).nullable(),
  /** Null for a design the person described themselves. */
  bank: bankRef,
});

export const draftThreatSchema = z.strictObject({
  id: threatId,
  name: text,
  /** What this study does about the threat. Empty until written (DS-04); the bank's general advice is not copied in. */
  mitigation: z.string().trim(),
  bank: bankRef,
});

export const draftSchema = z.strictObject({
  schemaVersion: z.literal(DRAFT_SCHEMA_VERSION),
  /** The next number for each id prefix. A number is used once, so a deleted object's id never comes back. */
  next: z.strictObject({
    q: z.number().int().positive(),
    h: z.number().int().positive(),
    t: z.number().int().positive(),
  }),
  questions: z.array(draftQuestionSchema),
  hypotheses: z.array(draftHypothesisSchema),
  design: draftDesignSchema.nullable(),
  threats: z.array(draftThreatSchema),
});
export type Draft = z.infer<typeof draftSchema>;
export type DraftQuestion = Draft['questions'][number];
export type DraftHypothesis = Draft['hypotheses'][number];
export type DraftDesign = NonNullable<Draft['design']>;
export type DraftThreat = Draft['threats'][number];

export const emptyDraft = (): Draft => ({
  schemaVersion: DRAFT_SCHEMA_VERSION,
  next: { q: 1, h: 1, t: 1 },
  questions: [],
  hypotheses: [],
  design: null,
  threats: [],
});
