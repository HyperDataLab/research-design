import { z } from 'zod';

/**
 * What the app and the Worker agree on for AI calls (docs/WORKER_API.md, "AI calls"). The Worker is the only
 * place that knows the router, the key and the model; the browser sends messages and gets text back.
 */

/** Bump when the consent text changes in substance; every account is then asked again. */
export const CONSENT_VERSION = 1;

/** What a call is for. The ledger groups usage by it; a new feature is added here first. */
export const LLM_FEATURES = [
  'connection_test',
  'fact_extraction',
  'bank_matching',
  'plan_suggestion',
] as const;
export type LlmFeature = (typeof LLM_FEATURES)[number];

/** `<name>@<n>`, e.g. `fact_extraction@1`. Prompts are versioned; the ledger records which one was used. */
export const promptVersionSchema = z.string().regex(/^[a-z][a-z0-9_]{0,39}@[1-9][0-9]{0,3}$/);

export const LLM_LIMITS = {
  /** Largest request body the Worker accepts for a call. */
  maxRequestBytes: 512 * 1024,
  maxMessages: 40,
  /** Used when the client does not ask for less; the Worker's env may lower it. */
  maxOutputTokens: 4096,
} as const;

/** A rough count for reservations and for routers that report no usage: four characters per token. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const message = z.strictObject({ role: z.enum(['system', 'user', 'assistant']), content: z.string().min(1) });

/** The whole of what a client may send. Anything else (model, n, stream, tools…) is refused, not forwarded. */
export const chatRequestSchema = z.strictObject({
  projectId: z.string().regex(/^[a-f0-9]{16}$/),
  feature: z.enum(LLM_FEATURES),
  promptVersion: promptVersionSchema,
  messages: z.array(message).min(1).max(LLM_LIMITS.maxMessages),
  maxOutputTokens: z.number().int().positive().max(LLM_LIMITS.maxOutputTokens).optional(),
  /** A JSON Schema the answer should follow. Passed as `response_format`; routers may ignore it. */
  responseSchema: z.record(z.string(), z.unknown()).optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

const tokens = z.number().int().nonnegative();
export const usageCountsSchema = z.strictObject({ inputTokens: tokens, outputTokens: tokens, calls: tokens });

export const chatResponseSchema = z.strictObject({
  content: z.string(),
  finishReason: z.string().nullable(),
  model: z.string(),
  usage: z.strictObject({
    inputTokens: tokens,
    outputTokens: tokens,
    /** True when the router reported no usage and the counts are `estimateTokens` of the texts. */
    estimated: z.boolean(),
  }),
});
export type ChatResponse = z.infer<typeof chatResponseSchema>;

export const consentRecordSchema = z.strictObject({
  version: z.number().int().positive(),
  provider: z.string().min(1),
  acceptedBy: z.string(),
  acceptedAt: z.string(),
});
export const consentStateSchema = z.strictObject({
  required: z.strictObject({ version: z.number().int().positive(), provider: z.string().min(1) }),
  /** Null when the account has not accepted the current version for the current provider. */
  accepted: consentRecordSchema.nullable(),
  /** False when the Worker has no router configured; no call can be made. */
  configured: z.boolean(),
});
export type ConsentState = z.infer<typeof consentStateSchema>;

export const usageSummarySchema = z.strictObject({
  /** The UTC day the budget counts, `YYYY-MM-DD`. It resets at 00:00 UTC (07:00 in Vietnam). */
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dailyBudget: tokens,
  today: usageCountsSchema.extend({ reservedTokens: tokens, estimatedCalls: tokens }),
  month: usageCountsSchema,
  byFeature: z.array(usageCountsSchema.extend({ feature: z.enum(LLM_FEATURES) })),
});
export type UsageSummary = z.infer<typeof usageSummarySchema>;
