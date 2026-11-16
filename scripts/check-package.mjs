import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

try {
  const filename = process.argv[2];
  if (!filename || process.argv.length !== 3) throw new Error('Usage: node scripts/check-package.mjs <zip>');
  const bytes = await readFile(filename);
  const end = bytes.length - 22;
  if (
    end < 0 ||
    bytes.readUInt32LE(end) !== 0x06054b50 ||
    bytes.readUInt16LE(end + 4) ||
    bytes.readUInt16LE(end + 6) ||
    bytes.readUInt16LE(end + 20)
  )
    throw new Error('Invalid ZIP end record');
  const count = bytes.readUInt16LE(end + 10);
  let pos = bytes.readUInt32LE(end + 16);
  if (bytes.readUInt16LE(end + 8) !== count || pos + bytes.readUInt32LE(end + 12) !== end)
    throw new Error('Invalid directory');
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (
      pos + 46 > end ||
      bytes.readUInt32LE(pos) !== 0x02014b50 ||
      bytes.readUInt16LE(pos + 8) !== 0x800 ||
      bytes.readUInt16LE(pos + 10) !== 0
    )
      throw new Error('Unsupported entry');
    const size = bytes.readUInt32LE(pos + 24),
      length = bytes.readUInt16LE(pos + 28),
      extra = bytes.readUInt16LE(pos + 30),
      comment = bytes.readUInt16LE(pos + 32),
      local = bytes.readUInt32LE(pos + 42);
    if (
      pos + 46 + length + extra + comment > end ||
      bytes.readUInt32LE(pos + 20) !== size ||
      local + 30 > bytes.length ||
      bytes.readUInt32LE(local) !== 0x04034b50 ||
      bytes.readUInt16LE(local + 6) !== 0x800 ||
      bytes.readUInt16LE(local + 8) !== 0 ||
      bytes.readUInt32LE(local + 18) !== size ||
      bytes.readUInt32LE(local + 22) !== size
    )
      throw new Error('Invalid entry');
    const name = new TextDecoder('utf-8', { fatal: true }).decode(
      bytes.subarray(pos + 46, pos + 46 + length),
    );
    const localNameLength = bytes.readUInt16LE(local + 26);
    const start = local + 30 + localNameLength + bytes.readUInt16LE(local + 28);
    if (
      localNameLength !== length ||
      !bytes.subarray(local + 30, local + 30 + length).equals(bytes.subarray(pos + 46, pos + 46 + length)) ||
      start + size > bytes.readUInt32LE(end + 16) ||
      files.has(name)
    )
      throw new Error('Invalid entry');
    files.set(name, bytes.subarray(start, start + size));
    console.log(`${name} (${size} bytes)`);
    pos += 46 + length + extra + comment;
  }
  if (
    pos !== end ||
    files.size !== 3 ||
    !files.has('manifest.json') ||
    !files.has('plan.json') ||
    !files.has('plan.md')
  )
    throw new Error('Invalid package entries');
  const manifest = JSON.parse(files.get('manifest.json').toString('utf8'));
  if (!Array.isArray(manifest.files) || manifest.files.length !== 2) throw new Error('Invalid manifest');
  for (const name of ['plan.json', 'plan.md']) {
    const matches = manifest.files.filter((entry) => entry.path === name);
    const actual = createHash('sha256').update(files.get(name)).digest('hex');
    if (matches.length !== 1 || matches[0].sha256 !== actual) throw new Error(`Hash mismatch: ${name}`);
    console.log(`${name}: SHA-256 OK`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
