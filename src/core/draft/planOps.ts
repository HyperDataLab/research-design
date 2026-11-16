import { RUN_TAGS } from '../plan/schema';
import {
  draftAnalysisSchema,
  draftRunMatrixSchema,
  MAX_SEEDS,
  runCount,
  type Draft,
  type DraftAnalysis,
  type DraftRunMatrix,
} from './schema';
import type { DraftError, DraftResult } from './ops';

type Input = Omit<DraftAnalysis, 'id'>;
const fail = (error: DraftError): DraftResult => ({ ok: false, error });
const ok = (doc: Draft): DraftResult => ({ ok: true, doc });
const unique = <T>(items: T[]) => [...new Set(items)];
const same = (a: unknown, b: unknown) => {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .sort(([x], [y]) => x.localeCompare(y))
          .map(([key, item]) => [key, canonical(item)]),
      );
    return value;
  };
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
};

function normalize(doc: Draft, input: Input): Input | DraftError {
  if (input.hypothesis && !doc.hypotheses.some((h) => h.id === input.hypothesis)) return 'unknown_hypothesis';
  if (input.variables.some((id) => !doc.variables.some((v) => v.id === id))) return 'unknown_variable';
  if (input.conditions.some((id) => !doc.conditions.some((c) => c.id === id))) return 'unknown_condition';
  if (!(input.alpha > 0 && input.alpha < 1)) return 'invalid_alpha';
  const parameters: Input['parameters'] = {};
  for (const [name, value] of Object.entries(input.parameters)) {
    if (!name.trim()) return 'invalid_text';
    parameters[name.trim()] = value;
  }
  const result = draftAnalysisSchema.safeParse({
    ...input,
    id: 'a-1',
    variables: unique(input.variables),
    conditions: unique(input.conditions),
    assumptions: input.assumptions.map((s) => s.trim()).filter(Boolean),
    parameters,
  });
  if (!result.success) return 'invalid_text';
  const { id, ...value } = result.data;
  void id;
  return value;
}
export function addAnalysis(doc: Draft, input: Input): DraftResult {
  const value = normalize(doc, input);
  if (typeof value === 'string') return fail(value);
  return ok({
    ...doc,
    next: { ...doc.next, a: doc.next.a + 1 },
    analyses: [...doc.analyses, { ...value, id: `a-${doc.next.a}` }],
  });
}
export function editAnalysis(doc: Draft, id: string, input: Input): DraftResult {
  const old = doc.analyses.find((a) => a.id === id);
  if (!old) return fail('unknown_analysis');
  const value = normalize(doc, input);
  if (typeof value === 'string') return fail(value);
  const entry = { ...value, id };
  return same(old, entry)
    ? ok(doc)
    : ok({ ...doc, analyses: doc.analyses.map((a) => (a.id === id ? entry : a)) });
}
export function removeAnalysis(doc: Draft, id: string): DraftResult {
  if (!doc.analyses.some((a) => a.id === id)) return fail('unknown_analysis');
  return ok({ ...doc, analyses: doc.analyses.filter((a) => a.id !== id) });
}
export function setRunMatrix(doc: Draft, matrix: DraftRunMatrix): DraftResult {
  if (matrix.conditions.some((id) => !doc.conditions.some((c) => c.id === id)))
    return fail('unknown_condition');
  if (matrix.datasets.some((id) => !doc.datasets.some((d) => d.id === id))) return fail('unknown_dataset');
  const value = {
    ...matrix,
    conditions: unique(matrix.conditions),
    datasets: unique(matrix.datasets),
    seeds: unique(matrix.seeds).sort((a, b) => a - b),
  };
  if (value.seeds.length > MAX_SEEDS) return fail('too_many_seeds');
  const parsed = draftRunMatrixSchema.safeParse(value);
  if (!parsed.success) return fail('invalid_text');
  return same(doc.runMatrix, parsed.data) ? ok(doc) : ok({ ...doc, runMatrix: parsed.data });
}
export function parseSeeds(
  text: string,
): { ok: true; seeds: number[] } | { ok: false; error: 'invalid_seeds' | 'too_many_seeds' } {
  const seeds = new Set<number>();
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, seeds: [] };
  if (!/^\d+(?:-\d+)?(?:(?:\s*,\s*|\s+)\d+(?:-\d+)?)*$/.test(trimmed))
    return { ok: false, error: 'invalid_seeds' };
  for (const part of trimmed.split(/[\s,]+/)) {
    const [first, last = first] = part.split('-').map(Number);
    if (
      first === undefined ||
      last === undefined ||
      !Number.isSafeInteger(first) ||
      !Number.isSafeInteger(last) ||
      first > last
    )
      return { ok: false, error: 'invalid_seeds' };
    if (last - first + 1 > MAX_SEEDS) return { ok: false, error: 'too_many_seeds' };
    for (let n = first; n <= last; n++) seeds.add(n);
    if (seeds.size > MAX_SEEDS) return { ok: false, error: 'too_many_seeds' };
  }
  return { ok: true, seeds: [...seeds].sort((a, b) => a - b) };
}
export function formatSeeds(seeds: number[]): string {
  const values = unique(seeds).sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = values[i]!;
    let end = start;
    while (values[i + 1] === end + 1) {
      end++;
      i++;
    }
    parts.push(end === start ? String(start) : `${start}-${end}`);
  }
  return parts.join(', ');
}
export function gridCells(doc: Draft, limit: number) {
  const cells: { condition: string; dataset: string; seed: number; tags: Record<string, string> }[] = [];
  outer: for (const condition of doc.runMatrix.conditions)
    for (const dataset of doc.runMatrix.datasets)
      for (const seed of doc.runMatrix.seeds) {
        if (cells.length >= limit) break outer;
        cells.push({
          condition,
          dataset,
          seed,
          tags: {
            [RUN_TAGS.condition]: condition,
            [RUN_TAGS.dataset]: dataset,
            [RUN_TAGS.seed]: String(seed),
          },
        });
      }
  return { cells, total: runCount(doc.runMatrix) };
}
