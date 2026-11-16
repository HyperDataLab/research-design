import { manifestSchema, planSchema, type ExperimentPlan, type PlanManifest } from './schema';
import { planMarkdown } from './planMarkdown';
import { readZipStore, zipStore } from './zip';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const json = (value: unknown) => encoder.encode(`${JSON.stringify(value, null, 2)}\n`);
async function hash(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function exportPackage(
  plan: ExperimentPlan,
): Promise<{ fileName: string; bytes: Uint8Array; manifest: PlanManifest }> {
  const planBytes = json(plan);
  const markdownBytes = encoder.encode(planMarkdown(plan));
  const manifest = manifestSchema.parse({
    format: plan.format,
    schemaVersion: plan.schemaVersion,
    planId: plan.planId,
    planVersion: plan.planVersion,
    files: [
      { path: 'plan.json', sha256: await hash(planBytes) },
      { path: 'plan.md', sha256: await hash(markdownBytes) },
    ],
  });
  return {
    fileName: `${plan.planId}-v${plan.planVersion}.zip`,
    manifest,
    bytes: zipStore([
      { path: 'manifest.json', bytes: json(manifest) },
      { path: 'plan.json', bytes: planBytes },
      { path: 'plan.md', bytes: markdownBytes },
    ]),
  };
}

export async function checkPackage(
  bytes: Uint8Array,
): Promise<{ ok: true; plan: ExperimentPlan; manifest: PlanManifest } | { ok: false; reason: string }> {
  try {
    const entries = readZipStore(bytes);
    if (entries.length !== 3) throw new Error('Expected exactly three package entries');
    const files = new Map(entries.map((entry) => [entry.path, entry.bytes]));
    const manifestBytes = files.get('manifest.json'),
      planBytes = files.get('plan.json'),
      markdownBytes = files.get('plan.md');
    if (!manifestBytes || !planBytes || !markdownBytes) throw new Error('Missing package entry');
    const manifest = manifestSchema.parse(JSON.parse(decoder.decode(manifestBytes)));
    const plan = planSchema.parse(JSON.parse(decoder.decode(planBytes)));
    if (
      manifest.planId !== plan.planId ||
      manifest.planVersion !== plan.planVersion ||
      manifest.files.length !== 2
    )
      throw new Error('Manifest does not match plan');
    for (const [path, content] of [
      ['plan.json', planBytes],
      ['plan.md', markdownBytes],
    ] as const) {
      const matching = manifest.files.filter((file) => file.path === path);
      if (matching.length !== 1 || matching[0]?.sha256 !== (await hash(content)))
        throw new Error(`Hash mismatch: ${path}`);
    }
    return { ok: true, plan, manifest };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'Invalid package' };
  }
}
