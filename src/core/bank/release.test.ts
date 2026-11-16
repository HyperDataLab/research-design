import { expect, it } from 'vitest';
import { contentHash, snapshotRelease } from './release';
import { snapshot } from './testSupport';

const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).buffer;

it('D51 hashes raw collections and aliases in their original order, including unknown fields', async () => {
  const raw = {
    collections: { z: [{ id: 'rd.alpha', extra: 1 }], a: [] },
    aliases: { 'rd.old': 'rd.alpha' },
  };
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(raw)));
  const expected = Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, '0')).join('');
  expect(await contentHash(raw)).toBe(expected);
  expect(
    await contentHash({ ...raw, collections: { ...raw.collections, z: [{ id: 'rd.alpha' }] } }),
  ).not.toBe(expected);
  expect(await contentHash({ ...raw, aliases: {} })).not.toBe(expected);
});

it('D51 accepts a verified release and rejects absent or incorrect hashes and malformed releases', async () => {
  const raw = { ...snapshot, release: '2031.02.1', aliases: { 'rd.alpha': 'rd.beta' } };
  const cut = { ...raw, contentHash: await contentHash(raw) };
  expect(await snapshotRelease(cut, bytes(cut))).toMatchObject({ ok: true, release: '2031.02.1' });
  expect(await snapshotRelease(raw, bytes(raw))).toMatchObject({ reason: 'hash_mismatch' });
  expect(await snapshotRelease({ ...cut, contentHash: '0'.repeat(64) }, bytes(cut))).toMatchObject({
    reason: 'hash_mismatch',
  });
  expect(await snapshotRelease({ ...cut, release: '2031.02.0' }, bytes(cut))).toMatchObject({
    reason: 'invalid',
  });
});

it('D51 retains the file byte hash for legacy snapshots', async () => {
  const input = bytes(snapshot);
  const digest = await crypto.subtle.digest('SHA-256', input);
  const hex = Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, '0')).join('');
  expect(await snapshotRelease(snapshot, input)).toMatchObject({ release: `sha256:${hex.slice(0, 16)}` });
});
