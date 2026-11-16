import type { Bucket } from './app';

export class MemoryBucket implements Bucket {
  values = new Map<string, { value: string; etag: string }>();
  touched: string[] = [];
  serial = 0;
  async get(key: string) {
    this.touched.push(key);
    const entry = this.values.get(key);
    return entry ? { httpEtag: `"${entry.etag}"`, text: async () => entry.value } : null;
  }
  async put(key: string, value: string, options?: { onlyIf: { etagMatches: string } }) {
    this.touched.push(key);
    if (options && this.values.get(key)?.etag !== options.onlyIf.etagMatches) return null;
    const entry = { value, etag: String(++this.serial) };
    this.values.set(key, entry);
    return { httpEtag: `"${entry.etag}"` };
  }
  async delete(key: string) {
    this.touched.push(key);
    this.values.delete(key);
  }
  async list(options: { prefix: string; cursor?: string }) {
    this.touched.push(options.prefix);
    const all = [...this.values.keys()].filter((key) => key.startsWith(options.prefix)).sort();
    const start = Number(options.cursor ?? 0);
    const objects = all.slice(start, start + 1).map((key) => ({ key }));
    const truncated = start + 1 < all.length;
    return { objects, truncated, ...(truncated ? { cursor: String(start + 1) } : {}) };
  }
}
