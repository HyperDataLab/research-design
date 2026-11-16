export interface ZipFile {
  path: string;
  bytes: Uint8Array;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const UTF8 = 0x800;

function validPath(path: string): boolean {
  return !!path && !path.startsWith('/') && !path.includes('..') && !path.includes('\\');
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function zipStore(files: ZipFile[]): Uint8Array {
  const names = new Set<string>();
  const records = files.map((file) => {
    if (!validPath(file.path) || names.has(file.path)) throw new Error('Invalid or duplicate ZIP path');
    names.add(file.path);
    const name = encoder.encode(file.path);
    if (name.length > 0xffff || file.bytes.length > 0xffffffff) throw new Error('ZIP entry too large');
    return { ...file, name, crc: crc32(file.bytes), offset: 0 };
  });
  if (records.length > 0xffff) throw new Error('Too many ZIP entries');
  const localSize = records.reduce((n, r) => n + 30 + r.name.length + r.bytes.length, 0);
  const centralSize = records.reduce((n, r) => n + 46 + r.name.length, 0);
  if (localSize > 0xffffffff || centralSize > 0xffffffff) throw new Error('ZIP too large');
  const output = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(output.buffer);
  let p = 0;
  for (const r of records) {
    r.offset = p;
    view.setUint32(p, 0x04034b50, true);
    view.setUint16(p + 4, 20, true);
    view.setUint16(p + 6, UTF8, true);
    view.setUint16(p + 12, 0x21, true);
    view.setUint32(p + 14, r.crc, true);
    view.setUint32(p + 18, r.bytes.length, true);
    view.setUint32(p + 22, r.bytes.length, true);
    view.setUint16(p + 26, r.name.length, true);
    output.set(r.name, p + 30);
    output.set(r.bytes, p + 30 + r.name.length);
    p += 30 + r.name.length + r.bytes.length;
  }
  for (const r of records) {
    view.setUint32(p, 0x02014b50, true);
    view.setUint16(p + 4, 20, true);
    view.setUint16(p + 6, 20, true);
    view.setUint16(p + 8, UTF8, true);
    view.setUint16(p + 14, 0x21, true);
    view.setUint32(p + 16, r.crc, true);
    view.setUint32(p + 20, r.bytes.length, true);
    view.setUint32(p + 24, r.bytes.length, true);
    view.setUint16(p + 28, r.name.length, true);
    view.setUint32(p + 42, r.offset, true);
    output.set(r.name, p + 46);
    p += 46 + r.name.length;
  }
  view.setUint32(p, 0x06054b50, true);
  view.setUint16(p + 8, records.length, true);
  view.setUint16(p + 10, records.length, true);
  view.setUint32(p + 12, centralSize, true);
  view.setUint32(p + 16, localSize, true);
  return output;
}

export function readZipStore(bytes: Uint8Array): ZipFile[] {
  const fail = (): never => {
    throw new Error('Invalid or unsupported stored ZIP');
  };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const check = (offset: number, length: number) => {
    if (offset < 0 || length < 0 || offset + length > bytes.length) fail();
  };
  const u16 = (p: number) => {
    check(p, 2);
    return view.getUint16(p, true);
  };
  const u32 = (p: number) => {
    check(p, 4);
    return view.getUint32(p, true);
  };
  const end = bytes.length - 22;
  if (end < 0 || u32(end) !== 0x06054b50 || u16(end + 4) || u16(end + 6) || u16(end + 20)) fail();
  const count = u16(end + 10);
  if (u16(end + 8) !== count) fail();
  const central = u32(end + 16);
  if (central + u32(end + 12) !== end) fail();
  let p = central;
  let nextLocal = 0;
  const result: ZipFile[] = [];
  const paths = new Set<string>();
  for (let i = 0; i < count; i++) {
    check(p, 46);
    if (u32(p) !== 0x02014b50 || u16(p + 8) !== UTF8 || u16(p + 10) !== 0 || u16(p + 34) !== 0) fail();
    const crc = u32(p + 16),
      size = u32(p + 24),
      nameLength = u16(p + 28);
    if (u32(p + 20) !== size) fail();
    const extra = u16(p + 30),
      comment = u16(p + 32),
      local = u32(p + 42);
    check(p + 46, nameLength + extra + comment);
    const nameBytes = bytes.subarray(p + 46, p + 46 + nameLength);
    const path = decoder.decode(nameBytes);
    if (!validPath(path) || paths.has(path) || local !== nextLocal) fail();
    paths.add(path);
    check(local, 30);
    if (
      u32(local) !== 0x04034b50 ||
      u16(local + 6) !== UTF8 ||
      u16(local + 8) !== 0 ||
      u32(local + 14) !== crc ||
      u32(local + 18) !== size ||
      u32(local + 22) !== size ||
      u16(local + 26) !== nameLength
    )
      fail();
    const data = local + 30 + nameLength + u16(local + 28);
    check(local + 30, nameLength + u16(local + 28) + size);
    if (data + size > central || !nameBytes.every((b, j) => bytes[local + 30 + j] === b)) fail();
    const content = bytes.slice(data, data + size);
    if (crc32(content) !== crc) fail();
    result.push({ path, bytes: content });
    nextLocal = data + size;
    p += 46 + nameLength + extra + comment;
  }
  if (p !== end || nextLocal !== central) fail();
  return result;
}
