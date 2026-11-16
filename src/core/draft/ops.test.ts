import { describe, expect, it } from 'vitest';
import { draftSchema, emptyDraft } from './schema';
import * as ops from './ops';
import { readSnapshot, toBankDoc } from '../bank/readSnapshot';
import { snapshot } from '../bank/testSupport';

const q = { text: ' Question ', gap: '', papers: [] };
const h = { statement: ' Hypothesis ', kind: 'directional' as const, question: 'q-1', claim: null };
function doc(result: ops.DraftResult) {
  if (!result.ok) throw Error(result.error);
  return draftSchema.parse(result.doc);
}
describe('draft edits', () => {
  it('DR-01 keeps ids and never reuses them', () => {
    let d = doc(ops.addQuestion(emptyDraft(), q));
    d = doc(ops.editQuestion(d, 'q-1', { ...q, text: 'Changed' }));
    expect(d.questions[0]?.id).toBe('q-1');
    d = doc(ops.removeQuestion(d, 'q-1'));
    d = doc(ops.addQuestion(d, q));
    expect(d.questions[0]?.id).toBe('q-2');
  });
  it('DR-07 a deleted hypothesis or threat id never comes back', () => {
    let d = doc(ops.addQuestion(emptyDraft(), q));
    d = doc(ops.addHypothesis(d, h));
    d = doc(ops.removeHypothesis(d, 'h-1'));
    d = doc(ops.addHypothesis(d, h));
    expect(d.hypotheses.map((x) => x.id)).toEqual(['h-2']);
    d = doc(ops.addThreat(d, { name: 'One', mitigation: '', bank: null }));
    d = doc(ops.removeThreat(d, 't-1'));
    d = doc(ops.addThreat(d, { name: 'Two', mitigation: '', bank: null }));
    expect(d.threats.map((x) => x.id)).toEqual(['t-2']);
  });
  it('DR-02 validates references and keeps hypothesis fields', () => {
    expect(ops.addHypothesis(emptyDraft(), h)).toMatchObject({ error: 'unknown_question' });
    let d = doc(ops.addQuestion(emptyDraft(), q));
    d = doc(ops.addHypothesis(d, h));
    expect(ops.removeQuestion(d, 'q-1')).toMatchObject({ error: 'has_hypotheses' });
    d.hypotheses[0]!.independent = ['v-1'];
    d = doc(ops.editHypothesis(d, 'h-1', { ...h, statement: 'Changed' }));
    expect(d.hypotheses[0]?.independent).toEqual(['v-1']);
    d = doc(ops.removeHypothesis(d, 'h-1'));
    expect(d.hypotheses).toHaveLength(0);
  });
  it('DR-03 reports errors and preserves identity for no-op', () => {
    const d = doc(ops.addQuestion(emptyDraft(), q));
    expect(ops.editQuestion(d, 'q-1', q)).toEqual({ ok: true, doc: d });
    expect(ops.editQuestion(d, 'q-1', q)).toHaveProperty('doc', d);
    expect(ops.addQuestion(d, { ...q, text: ' ' })).toMatchObject({ error: 'invalid_text' });
    expect(ops.removeQuestion(d, 'q-9')).toMatchObject({ error: 'unknown_question' });
    expect(ops.removeHypothesis(d, 'h-9')).toMatchObject({ error: 'unknown_hypothesis' });
    expect(ops.removeThreat(d, 't-9')).toMatchObject({ error: 'unknown_threat' });
    expect(ops.setAssignment(d, 'random')).toMatchObject({ error: 'no_design' });
  });
  it('DR-04 handles bank design and threat duplicates', () => {
    const parsed = readSnapshot(snapshot);
    if (!parsed.ok) throw Error();
    const design = ops.designFromBank(parsed.file.collections.designs[1]!, 'sha256:0123456789abcdef');
    expect(design.assignment).toBeNull();
    let d = doc(ops.setDesign(emptyDraft(), design));
    d = doc(ops.setAssignment(d, 'random'));
    const t = {
      name: 'Threat',
      mitigation: '',
      bank: { id: 'vt.test-confound', release: 'sha256:0123456789abcdef' },
    };
    d = doc(ops.addThreat(d, t));
    expect(ops.addThreat(d, t)).toMatchObject({ error: 'duplicate_threat' });
    d = doc(ops.editThreat(d, 't-1', { name: 'Changed', mitigation: 'Mitigated' }));
    expect(d.threats[0]?.id).toBe('t-1');
    expect(doc(ops.removeThreat(d, 't-1')).threats).toHaveLength(0);
  });
});

it('DR-06 repins existing references and leaves missing references and no-ops intact', () => {
  const parsed = readSnapshot(snapshot);
  if (!parsed.ok) throw Error();
  const bank = toBankDoc(parsed.file, 'sha256:0123456789abcdef', 'test', '2026-01-01T00:00:00Z');
  const d = emptyDraft();
  d.design = { name: 'Test', assignment: null, bank: { id: 'rd.test-benchmark', release: 'old' } };
  d.threats = [
    { id: 't-1', name: 'One', mitigation: '', bank: { id: 'vt.test-confound', release: 'old' } },
    { id: 't-2', name: 'Missing', mitigation: '', bank: { id: 'vt.missing', release: 'old' } },
  ];
  const result = ops.repin(d, bank);
  if (!result.ok) throw Error();
  expect(result.doc.design?.bank?.release).toBe(bank.release);
  expect(result.doc.threats.map((t) => t.bank?.release)).toEqual([bank.release, 'old']);
  expect(ops.repin(result.doc, bank)).toEqual({ ok: true, doc: result.doc });
  const again = ops.repin(result.doc, bank);
  if (!again.ok) throw Error();
  expect(again.doc).toBe(result.doc);
});

it('D51 follows aliases for references and claims, stopping at missing targets and cycles', () => {
  const parsed = readSnapshot(snapshot);
  if (!parsed.ok) throw Error();
  const bank = {
    ...toBankDoc(parsed.file, '2031.02.1', 'test', '2031-02-01T00:00:00Z'),
    aliases: {
      'rd.alpha': 'rd.beta',
      'rd.beta': 'rd.test-benchmark',
      'rd.test-benchmark': 'rd.test-experiment',
      'vt.alpha': 'vt.test-confound',
      'vt.missing': 'vt.absent',
      'vt.cycle': 'vt.loop',
      'vt.loop': 'vt.cycle',
      'ct.gamma': 'ct.causal',
    },
  };
  const draft = emptyDraft();
  draft.design = { name: 'Test', assignment: null, bank: { id: 'rd.alpha', release: 'old' } };
  draft.threats = ['vt.alpha', 'vt.missing', 'vt.cycle'].map((id, i) => ({
    id: `t-${i + 1}`,
    name: id,
    mitigation: '',
    bank: { id, release: 'old' },
  }));
  draft.hypotheses = [{ ...h, id: 'h-1', claim: 'ct.gamma', independent: [], dependent: [] }];
  const updated = doc(ops.repin(draft, bank));
  expect(updated.design?.bank).toEqual({ id: 'rd.test-benchmark', release: bank.release });
  expect(updated.threats.map((t) => t.bank)).toEqual([
    { id: 'vt.test-confound', release: bank.release },
    { id: 'vt.missing', release: 'old' },
    { id: 'vt.cycle', release: 'old' },
  ]);
  expect(updated.hypotheses[0]?.claim).toBe('ct.causal');
  expect(doc(ops.repin(updated, bank)).design?.bank?.id).toBe('rd.test-benchmark');
  const long = {
    ...bank,
    aliases: Object.fromEntries(
      Array.from({ length: 11 }, (_, i) => [`rd.${i}`, i === 10 ? 'rd.test-benchmark' : `rd.${i + 1}`]),
    ),
  };
  draft.design.bank = { id: 'rd.0', release: 'old' };
  expect(doc(ops.repin(draft, long)).design?.bank).toEqual(draft.design.bank);
});
