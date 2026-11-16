// Makes the Writing Bank snapshot file a person imports on the project's Writing Bank screen.
//
//   node scripts/make-bank-snapshot.mjs <path to a writing-bank checkout> [output file]
//
// Writing Bank has no release identifier and no /bank/v1 yet (docs/CONTRACTS.md). Until it has, this script
// copies the collections this app reads out of the bank's seed, entries unchanged. The output holds the bank's
// content and Writing Bank is a private repository: the file is git-ignored and must not be committed here.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const COLLECTIONS = ['designs', 'threats', 'claim-types', 'metrics', 'protocols', 'benchmarks'];
const [bankDir, out = 'bank-snapshot.local.json'] = process.argv.slice(2);
if (!bankDir) {
  console.error('Usage: node scripts/make-bank-snapshot.mjs <path to a writing-bank checkout> [output file]');
  process.exit(1);
}
const root = path.join(bankDir, 'data', 'banks');
if (!fs.existsSync(root)) {
  console.error(`Refused: ${root} does not exist. Give the root of a writing-bank checkout.`);
  process.exit(1);
}
const collections = {};
for (const name of COLLECTIONS) {
  const folder = path.join(root, name);
  const files = fs.existsSync(folder)
    ? fs
        .readdirSync(folder)
        .filter((file) => file.endsWith('.json'))
        .sort()
    : [];
  collections[name] = files.flatMap((file) => {
    const content = JSON.parse(fs.readFileSync(path.join(folder, file), 'utf8'));
    if (!Array.isArray(content)) throw new Error(`${name}/${file} is not a list of entries.`);
    return content;
  });
}
let source = '';
try {
  const git = (...args) => execFileSync('git', ['-C', bankDir, ...args], { encoding: 'utf8' }).trim();
  source = `writing-bank ${git('rev-parse', '--short', 'HEAD')} (${git('log', '-1', '--format=%cs')})`;
} catch {
  // Not a git checkout: the file still imports, it only says less about where it came from.
}
fs.writeFileSync(
  out,
  JSON.stringify({ format: 'writing-bank-snapshot', formatVersion: 1, source, collections }, null, 1) + '\n',
);
const counts = COLLECTIONS.map((name) => `${name} ${collections[name].length}`).join(', ');
console.log(`Wrote ${out}: ${counts}. ${source}`);
