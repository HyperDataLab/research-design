import { describe, expect, it } from 'vitest';
import { readZipStore, zipStore } from './zip';

const enc = new TextEncoder();
describe('stored ZIP', () => {
  it('ZP-01 round trips, including empty and UTF-8 files', () => {
    const files = [
      { path: 'a', bytes: enc.encode('123456789') },
      { path: 'rỗng.txt', bytes: enc.encode('xin chào') },
      { path: 'empty', bytes: new Uint8Array() },
    ];
    const read = readZipStore(zipStore(files));
    expect(read.map((file) => [file.path, Array.from(file.bytes)])).toEqual(
      files.map((file) => [file.path, Array.from(file.bytes)]),
    );
    expect(new DataView(zipStore(files).buffer).getUint32(14, true)).toBe(0xcbf43926);
  });
  it('ZP-02 is deterministic and refuses invalid paths', () => {
    expect(zipStore([])).toEqual(zipStore([]));
    for (const path of ['/a', '../a', 'a\\b', '', 'a..b'])
      expect(() => zipStore([{ path, bytes: new Uint8Array() }])).toThrow();
    expect(() =>
      zipStore([
        { path: 'a', bytes: new Uint8Array() },
        { path: 'a', bytes: new Uint8Array() },
      ]),
    ).toThrow();
  });
  it('ZP-03 refuses deflated and truncated archives', () => {
    const bytes = zipStore([{ path: 'a', bytes: enc.encode('a') }]);
    expect(() => readZipStore(bytes.slice(0, -1))).toThrow();
    bytes[8] = 8;
    expect(() => readZipStore(bytes)).toThrow();
  });
});
