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
