import { spawnSync } from 'node:child_process';

const steps = [
  ['typecheck', ['run', 'typecheck']],
  ['install worker dependencies', ['ci', '--prefix', 'worker']],
  ['typecheck worker', ['run', 'typecheck:worker']],
  ['test worker', ['run', 'test:worker']],
  ['lint', ['run', 'lint']],
  ['format check', ['run', 'format:check']],
  ['test with coverage', ['run', 'test:cov']],
  ['build', ['run', 'build']],
];

for (const [name, args] of steps) {
  console.log(`\n> Checking: ${name}`);
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.error(`Check failed: ${name}${result.error ? ` (${result.error.message})` : ''}`);
    process.exit(result.status || 1);
  }
}
