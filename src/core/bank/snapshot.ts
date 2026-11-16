import { z } from 'zod';

/**
 * A snapshot of the Writing Bank collections this app reads, pinned to a project as the `bank` document.
 *
 * Writing Bank owns these models. This file restates none of them: it reads the few fields the screens use and
 * ignores the rest, so a field the bank adds does not break an import.
 */
export const SNAPSHOT_FORMAT = 'writing-bank-snapshot';
export const SNAPSHOT_FORMAT_VERSION = 1;

const text = z.string().trim().min(1);
const status = z.string().optional();

export const bankDesignSchema = z.object({
  id: z.string().regex(/^rd\./),
  status,
  name: text,
  family: z.string(),
  definition: z.string(),
  assignment: z.enum(['random', 'non_random', 'none', 'either']),
  causalLicence: z.string(),
  supports: z.array(z.string()),
  cannotSupport: z.array(z.string()).default([]),
  threats: z.array(z.string()).default([]),
});
export const bankThreatSchema = z.object({
  id: z.string().regex(/^vt\./),
  status,
  type: z.string(),
  name: text,
  mechanism: z.string(),
  mitigation: z.string(),
});
export const bankClaimTypeSchema = z.object({
  id: z.string().regex(/^ct\./),
  status,
  name: text,
  definition: z.string(),
});
/** Collections a later slice reads (Đo lường). Kept whole so the project does not need a second import. */
const keptWhole = z.array(z.looseObject({ id: z.string() })).default([]);

const collectionsSchema = z.object({
  designs: z.array(bankDesignSchema),
  threats: z.array(bankThreatSchema),
  'claim-types': z.array(bankClaimTypeSchema),
  metrics: keptWhole,
  protocols: keptWhole,
  benchmarks: keptWhole,
});

/**
 * Views over the entries kept whole. An entry that does not fit its view is skipped by the reader, not refused:
 * the stored document was accepted when it was imported.
 */
export const bankMetricSchema = z.object({
  id: z.string().regex(/^met\./),
  status,
  name: text,
  aliases: z.array(z.string()).default([]),
  family: z.string(),
  definition: z.string(),
  unit: z.string().nullable().default(null),
  direction: z.enum(['higher_better', 'lower_better', 'target_value', 'descriptive']),
  /** The strongest statement the metric supports alone. Shown as text; it is not the `ct.*` vocabulary. */
  maxClaim: z.string().default(''),
  doesNotSupport: z.array(z.string()).default([]),
  requiredReporting: z.array(z.string()).default([]),
});
export const bankProtocolSchema = z.object({
  id: z.string().regex(/^mp\./),
  status,
  name: text,
  purpose: z.string(),
  procedure: z.array(z.string()).default([]),
  report: z.array(z.string()).default([]),
  metrics: z.array(z.string()).default([]),
});
export const bankBenchmarkSchema = z.object({
  id: z.string().regex(/^bm\./),
  status,
  name: text,
  task: z.string(),
  metrics: z.array(z.string()).default([]),
  protocol: z.string().default(''),
  lifecycle: z.string().default('unknown'),
  knownFlaws: z.array(z.string()).default([]),
  url: z.string().optional(),
});
export type BankMetric = z.infer<typeof bankMetricSchema>;
export type BankProtocol = z.infer<typeof bankProtocolSchema>;
export type BankBenchmark = z.infer<typeof bankBenchmarkSchema>;

/** The file a person imports. */
export const snapshotFileSchema = z.object({
  format: z.literal(SNAPSHOT_FORMAT),
  formatVersion: z.literal(SNAPSHOT_FORMAT_VERSION),
  /** Where the file was made from, for people: the bank's commit and date. Not trusted and not a release. */
  source: z.string().default(''),
  release: z
    .string()
    .regex(/^\d{4}\.\d{2}\.[1-9]\d*$/)
    .optional(),
  date: z.iso.datetime().optional(),
  notes: z.string().optional(),
  contentHash: z.unknown().optional(),
  includesDrafts: z.boolean().optional(),
  aliases: z.record(z.string(), z.string()).optional(),
  collections: collectionsSchema,
});

/** The `bank` document of a project. */
export const bankDocSchema = z.strictObject({
  schemaVersion: z.literal(1),
  release: z.string().regex(/^(?:sha256:[0-9a-f]{16}|\d{4}\.\d{2}\.[1-9]\d*)$/),
  releaseDate: z.iso.datetime().nullable().default(null),
  contentHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable()
    .default(null),
  includesDrafts: z.boolean().default(false),
  aliases: z.record(z.string(), z.string()).default({}),
  source: z.string(),
  importedBy: z.string(),
  importedAt: z.iso.datetime(),
  collections: collectionsSchema,
});
export type BankDoc = z.infer<typeof bankDocSchema>;
export type BankDesign = z.infer<typeof bankDesignSchema>;
export type BankThreat = z.infer<typeof bankThreatSchema>;
export type BankClaimType = z.infer<typeof bankClaimTypeSchema>;
