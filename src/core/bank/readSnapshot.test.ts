import { describe, expect, it } from 'vitest';
import { readSnapshot, toBankDoc, findDesign, findThreat, findClaimType } from './readSnapshot';
import { snapshot } from './testSupport';
import { bankDocSchema } from './snapshot';

describe('snapshot', () => {
  it('BK-01 accepts extra fields and exposes collections', () => {
    const result = readSnapshot({ ...snapshot, extra: true });
    expect(result.ok).toBe(true);
    if (!result.ok) throw Error();
    const bank = toBankDoc(result.file, 'sha256:0123456789abcdef', 'test', '2026-01-01T00:00:00Z');
    expect(findDesign(bank, 'rd.test-experiment')?.name).toBe('Test experiment');
    expect(findThreat(bank, 'vt.test-confound')).toBeDefined();
    expect(findClaimType(bank, 'ct.causal')).toBeDefined();
  });
  it('BK-02 refuses wrong format and version', () => {
    expect(readSnapshot(null)).toMatchObject({ reason: 'not_a_snapshot' });
    expect(readSnapshot({ ...snapshot, formatVersion: 2 })).toMatchObject({ reason: 'unsupported_version' });
  });
  it('BK-03 requires supports and limits issues', () => {
    const design = { ...snapshot.collections.designs[0], supports: undefined };
    expect(
      readSnapshot({ ...snapshot, collections: { ...snapshot.collections, designs: [design] } }),
    ).toMatchObject({
      reason: 'invalid',
      issues: expect.arrayContaining([expect.stringContaining('supports')]),
    });
  });
  it('D51 reads release metadata and defaults old stored documents', () => {
    const metadata = {
      release: '2031.02.1',
      date: '2031-02-01T00:00:00Z',
      notes: 'Test',
      contentHash: 'a'.repeat(64),
      includesDrafts: true,
      aliases: { 'rd.alpha': 'rd.beta' },
    };
    const parsed = readSnapshot({ ...snapshot, ...metadata, extra: true });
    if (!parsed.ok) throw Error();
    expect(parsed.file).toMatchObject(metadata);
    expect(parsed.file).not.toHaveProperty('extra');
    const bank = toBankDoc(parsed.file, metadata.release, 'test', '2031-02-02T00:00:00Z');
    expect(bank).toMatchObject({
      releaseDate: metadata.date,
      contentHash: metadata.contentHash,
      includesDrafts: true,
      aliases: metadata.aliases,
    });
    const old = {
      schemaVersion: bank.schemaVersion,
      source: bank.source,
      importedBy: bank.importedBy,
      importedAt: bank.importedAt,
      collections: bank.collections,
    };
    expect(bankDocSchema.parse({ ...old, release: 'sha256:0123456789abcdef' })).toMatchObject({
      releaseDate: null,
      contentHash: null,
      includesDrafts: false,
      aliases: {},
    });
    expect(bankDocSchema.safeParse({ ...bank, extra: true }).success).toBe(false);
  });
});
