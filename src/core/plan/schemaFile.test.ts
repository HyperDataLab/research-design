import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { examplePlan } from './examplePlan';
import { manifestSchema, planSchema } from './schema';

/**
 * The files under `schemas/` are what other systems vendor. They are generated from the Zod schemas
 * (`npm run schema:export`) and this test fails when a committed file and the code differ.
 */
const files: [string, unknown][] = [
  ['experiment-plan-v1.schema.json', z.toJSONSchema(planSchema)],
  ['experiment-plan-manifest-v1.schema.json', z.toJSONSchema(manifestSchema)],
  ['experiment-plan-v1.example.json', examplePlan()],
];

it.each(files)('schemas/%s matches the Zod schema', (name, value) => {
  const path = join(process.cwd(), 'schemas', name);
  const expected = `${JSON.stringify(value, null, 2)}\n`;
  if (process.env.UPDATE_SCHEMA) writeFileSync(path, expected, 'utf8');
  expect(existsSync(path), `${name} is missing: run npm run schema:export`).toBe(true);
  expect(readFileSync(path, 'utf8').replace(/\r\n/g, '\n')).toBe(expected);
});
