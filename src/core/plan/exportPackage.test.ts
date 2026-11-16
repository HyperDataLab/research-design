import { expect, it } from 'vitest';
import { examplePlan } from './examplePlan';
import { checkPackage, exportPackage } from './exportPackage';
import { manifestSchema } from './schema';
import { readZipStore, zipStore } from './zip';

it('EP-01 exports exact hashed bytes and validates the package', async () => {
  const plan = examplePlan();
  const result = await exportPackage(plan);
  const files = readZipStore(result.bytes);
  expect(files.map((f) => f.path)).toEqual(['manifest.json', 'plan.json', 'plan.md']);
  expect(manifestSchema.parse(result.manifest)).toEqual(result.manifest);
  expect(JSON.parse(new TextDecoder().decode(files[1]!.bytes))).toEqual(plan);
  for (const entry of result.manifest.files) {
    const bytes = files.find((f) => f.path === entry.path)!.bytes;
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
    expect(Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')).toBe(
      entry.sha256,
    );
  }
  expect(await checkPackage(result.bytes)).toEqual({ ok: true, plan, manifest: result.manifest });
  files[1]!.bytes[0] = files[1]!.bytes[0]! ^ 1;
  expect((await checkPackage(zipStore(files))).ok).toBe(false);
});
