// Rewrites schemas/*.schema.json from the Zod schemas. The same test, run without UPDATE_SCHEMA, fails when the
// committed file and the Zod schema differ, so the published contract cannot drift from the code.
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vitest', 'run', 'src/core/plan/schemaFile.test.ts'],
  { stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, UPDATE_SCHEMA: '1' } },
);
process.exit(result.status ?? 1);
