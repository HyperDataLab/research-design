import { z } from 'zod';
import { LLM_FEATURES, usageCountsSchema, type LlmFeature } from '../../src/core/llm/contract';
import { type Bucket, PREFIX } from './app';

export interface Counts {
  inputTokens: number;
  outputTokens: number;
  calls: number;
}
export interface Entry {
  id: string;
  at: string;
  projectId: string;
  feature: LlmFeature;
  promptVersion: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimated: boolean;
}
export interface Reservation {
  id: string;
  tokens: number;
  at: string;
  projectId: string;
  feature: LlmFeature;
  promptVersion: string;
  model: string;
}
export interface Day {
  entries: Entry[];
  reservations: Reservation[];
  totals: Counts;
  byFeature: Partial<Record<LlmFeature, Counts>>;
}
export interface Month {
  totals: Counts;
}
const feature = z.enum(LLM_FEATURES);
const fields = {
  id: z.string(),
  at: z.iso.datetime({ offset: true }),
  projectId: z.string(),
  feature,
  promptVersion: z.string(),
  model: z.string(),
};
const entrySchema = z.strictObject({
  ...fields,
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  estimated: z.boolean(),
});
const reservationSchema = z.strictObject({ ...fields, tokens: z.number().int().nonnegative() });
export const daySchema = z.strictObject({
  entries: z.array(entrySchema),
  reservations: z.array(reservationSchema),
  totals: usageCountsSchema,
  byFeature: z.partialRecord(feature, usageCountsSchema),
});
export const monthSchema = z.strictObject({ totals: usageCountsSchema });
export const emptyCounts = (): Counts => ({ inputTokens: 0, outputTokens: 0, calls: 0 });
export const emptyDay = (): Day => ({ entries: [], reservations: [], totals: emptyCounts(), byFeature: {} });
export const addCounts = (a: Counts, inputTokens: number, outputTokens: number): Counts => ({
  inputTokens: a.inputTokens + inputTokens,
  outputTokens: a.outputTokens + outputTokens,
  calls: a.calls + 1,
});
export function addEntry(day: Day, entry: Entry): Day {
  return {
    ...day,
    entries: [...day.entries, entry],
    totals: addCounts(day.totals, entry.inputTokens, entry.outputTokens),
    byFeature: {
      ...day.byFeature,
      [entry.feature]: addCounts(
        day.byFeature[entry.feature] ?? emptyCounts(),
        entry.inputTokens,
        entry.outputTokens,
      ),
    },
  };
}
export function expire(day: Day, now: Date): Day {
  let result = {
    ...day,
    reservations: day.reservations.filter((r) => now.getTime() - Date.parse(r.at) <= 600000),
  };
  for (const r of day.reservations.filter((item) => now.getTime() - Date.parse(item.at) > 600000)) {
    result = addEntry(result, {
      id: r.id,
      at: r.at,
      projectId: r.projectId,
      feature: r.feature,
      promptVersion: r.promptVersion,
      model: r.model,
      inputTokens: r.tokens,
      outputTokens: 0,
      estimated: true,
    });
  }
  return result;
}
export const usageKey = (email: string, date: string) => `${PREFIX}usage/${email}/${date}.json`;
export const id = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) => n.toString(16).padStart(2, '0')).join('');
export async function readValue<T>(
  bucket: Bucket,
  key: string,
  fallback: () => T,
  schema: z.ZodType<T>,
): Promise<T> {
  const found = await bucket.get(key);
  return found ? schema.parse(JSON.parse(await found.text())) : fallback();
}
export async function update<T>(
  bucket: Bucket,
  key: string,
  fallback: () => T,
  change: (value: T) => T | null,
  schema: z.ZodType<T>,
): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await bucket.get(key);
    const value = current ? schema.parse(JSON.parse(await current.text())) : fallback();
    const next = change(value);
    if (next === null) return false;
    const written = await bucket.put(
      key,
      JSON.stringify(next),
      current ? { onlyIf: { etagMatches: current.httpEtag.slice(1, -1) } } : undefined,
    );
    if (written) return true;
  }
  return false;
}
