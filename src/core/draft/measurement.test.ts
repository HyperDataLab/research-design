import { describe, expect, it } from 'vitest';
import { emptyDraft, draftSchema, type Draft } from './schema';
import {
  addVariable,
  addMetric,
  addDataset,
  addCondition,
  editVariable,
  editMetric,
  editDataset,
  editCondition,
  removeVariable,
  removeMetric,
  removeDataset,
  removeCondition,
  setHypothesisVariables,
  users,
  metricFromBank,
  datasetFromBank,
} from './measureOps';
import { addHypothesis, repin } from './ops';
import { checkChain } from './checkChain';
import { checkDesign } from './checkDesign';
import { bankMetrics, bankProtocols, bankBenchmarks, readSnapshot, toBankDoc } from '../bank/readSnapshot';
import { snapshot } from '../bank/testSupport';
import { bankRefs } from './bankRefs';
import { examplePlan } from '../plan/examplePlan';
import { validatePlan } from '../plan/validatePlan';

const result = (r: ReturnType<typeof addVariable>): Draft => {
  if (!r.ok) throw new Error(r.error);
  return draftSchema.parse(r.doc);
};
const variable = { name: 'Score', role: 'dependent' as const, construct: '', metric: null, levels: [] };
const metric = {
  name: 'Score',
  key: 'test/score',
  unit: 'points',
  goal: 'maximize' as const,
  aggregation: 'mean' as const,
  protocol: 'Test procedure',
  bank: null,
  protocolBank: null,
};
const dataset = {
  name: 'Test data',
  source: 'Test source',
  version: null,
  split: null,
  sha256: null,
  benchmark: null,
};
const condition = { name: 'Test condition', baseline: true, params: {} };
const bankFile = readSnapshot(snapshot);
if (!bankFile.ok) throw new Error('fixture');
const bank = toBankDoc(bankFile.file, 'sha256:1111111111111111', 'test', '2026-01-01T00:00:00Z');

describe('measurement', () => {
  it('MO-03 edits preserve identity on no-op and reject missing objects and empty names', () => {
    let d = emptyDraft();
    expect(editVariable(d, 'v-1', variable)).toEqual({ ok: false, error: 'unknown_variable' });
    expect(editMetric(d, 'm-1', metric)).toEqual({ ok: false, error: 'unknown_metric' });
    expect(editDataset(d, 'd-1', dataset)).toEqual({ ok: false, error: 'unknown_dataset' });
    expect(editCondition(d, 'c-1', condition)).toEqual({ ok: false, error: 'unknown_condition' });
    expect(setHypothesisVariables(d, 'h-1', { independent: [], dependent: [] })).toEqual({
      ok: false,
      error: 'unknown_hypothesis',
    });
    expect(addVariable(d, { ...variable, name: ' ' })).toEqual({ ok: false, error: 'invalid_text' });
    d = result(addVariable(d, variable));
    d = result(addMetric(d, metric));
    d = result(addDataset(d, dataset));
    d = result(addCondition(d, condition));
    for (const r of [
      editVariable(d, 'v-1', variable),
      editMetric(d, 'm-1', metric),
      editDataset(d, 'd-1', dataset),
      editCondition(d, 'c-1', condition),
    ]) {
      expect(r.ok && r.doc === d).toBe(true);
    }
  });
  it('CH-00 a clean chain passes PP-04 and PP-06 in a full plan', () => {
    let d = result(
      addHypothesis(emptyDraft(), { statement: 'Test', kind: 'exploratory', question: null, claim: null }),
    );
    d = result(addMetric(d, metric));
    d = result(addVariable(d, { ...variable, metric: 'm-1' }));
    d = result(setHypothesisVariables(d, 'h-1', { independent: [], dependent: ['v-1'] }));
    expect(checkChain(d)).toEqual([]);
    const plan = examplePlan();
    const h = d.hypotheses[0]!;
    const v = d.variables[0]!;
    const m = d.metrics[0]!;
    plan.hypotheses = [
      { id: h.id, statement: h.statement, kind: h.kind, independent: h.independent, dependent: h.dependent },
    ];
    plan.variables = [{ id: v.id, name: v.name, role: v.role, metric: v.metric, levels: v.levels }];
    plan.metrics = [
      {
        id: m.id,
        name: m.name,
        key: m.key,
        unit: m.unit,
        goal: m.goal!,
        aggregation: m.aggregation!,
        protocol: m.protocol,
        bank: m.bank,
      },
    ];
    expect(validatePlan(plan).filter((issue) => issue.rule === 'PP-04' || issue.rule === 'PP-06')).toEqual(
      [],
    );
  });
  it('MO-01 IDs are never reused and old drafts acquire defaults', () => {
    let d = draftSchema.parse({
      schemaVersion: 1,
      next: { q: 1, h: 1, t: 1 },
      questions: [],
      hypotheses: [],
      design: null,
      threats: [],
    });
    d = result(addVariable(d, variable));
    d = result(removeVariable(d, 'v-1'));
    d = result(addVariable(d, variable));
    d = result(addMetric(d, metric));
    d = result(removeMetric(d, 'm-1'));
    d = result(addMetric(d, metric));
    d = result(addDataset(d, dataset));
    d = result(removeDataset(d, 'd-1'));
    d = result(addDataset(d, dataset));
    d = result(addCondition(d, condition));
    d = result(removeCondition(d, 'c-1'));
    d = result(addCondition(d, condition));
    expect([d.variables[0]?.id, d.metrics[0]?.id, d.datasets[0]?.id, d.conditions[0]?.id]).toEqual([
      'v-2',
      'm-2',
      'd-2',
      'c-2',
    ]);
  });
  it('MO-02 validates links and refuses deletion while used', () => {
    let d = emptyDraft();
    expect(addVariable(d, { ...variable, metric: 'm-1' })).toEqual({ ok: false, error: 'unknown_metric' });
    d = result(addMetric(d, metric));
    d = result(addVariable(d, { ...variable, metric: 'm-1' }));
    d = result(
      addHypothesis(d, { statement: 'Test hypothesis', kind: 'exploratory', question: null, claim: null }),
    );
    expect(setHypothesisVariables(d, 'h-1', { independent: ['v-1'], dependent: [] })).toEqual({
      ok: false,
      error: 'wrong_role',
    });
    expect(setHypothesisVariables(d, 'h-1', { independent: [], dependent: ['v-2'] })).toEqual({
      ok: false,
      error: 'unknown_variable',
    });
    d = result(setHypothesisVariables(d, 'h-1', { independent: [], dependent: ['v-1', 'v-1'] }));
    expect(users(d, 'm-1')).toEqual(['v-1']);
    expect(removeMetric(d, 'm-1')).toEqual({ ok: false, error: 'in_use' });
    expect(removeVariable(d, 'v-1')).toEqual({ ok: false, error: 'in_use' });
    expect(setHypothesisVariables(d, 'h-1', { independent: [], dependent: ['v-1'] })).toEqual({
      ok: true,
      doc: d,
    });
    expect(addMetric(d, { ...metric, key: '!' })).toEqual({ ok: false, error: 'invalid_key' });
    expect(addDataset(d, { ...dataset, sha256: 'bad' })).toEqual({ ok: false, error: 'invalid_hash' });
  });
  it('BR-01 readers skip invalid entries and map invented bank entries', () => {
    const bad = {
      ...bank,
      collections: { ...bank.collections, metrics: [...bank.collections.metrics, { id: 'met.bad' }] },
    };
    expect(bankMetrics(bad)).toHaveLength(2);
    expect(bankProtocols(bank)).toHaveLength(1);
    expect(bankBenchmarks(bank)).toHaveLength(1);
    expect(metricFromBank(bankMetrics(bank)[1]!, bank.release)).toMatchObject({
      unit: '',
      goal: null,
      key: '',
    });
    expect(datasetFromBank(bankBenchmarks(bank)[0]!, bank.release)).toMatchObject({
      source: '',
      benchmark: { id: 'bm.test-suite' },
    });
  });
  it('BR-02 references are checked and repinned independently', () => {
    let d = result(
      addMetric(emptyDraft(), {
        ...metric,
        bank: { id: 'met.test-score', release: 'sha256:2222222222222222' },
        protocolBank: { id: 'mp.test-procedure', release: 'sha256:2222222222222222' },
      }),
    );
    d = result(
      addDataset(d, { ...dataset, benchmark: { id: 'bm.test-suite', release: 'sha256:2222222222222222' } }),
    );
    expect(bankRefs(d)).toHaveLength(3);
    expect(checkDesign(d, bank).filter((f) => f.rule === 'DS-05')).toHaveLength(3);
    d = result(repin(d, bank));
    expect(checkDesign(d, bank)).toEqual([]);
    expect(repin(d, bank)).toEqual({ ok: true, doc: d });
  });
  it('CH-01 through CH-09 detect incomplete chains', () => {
    let d = result(
      addHypothesis(emptyDraft(), { statement: 'Test', kind: 'exploratory', question: null, claim: null }),
    );
    d = result(addVariable(d, { ...variable, role: 'independent', metric: null }));
    d = result(addMetric(d, { ...metric, key: 'plan.id', unit: '' }));
    d = result(addMetric(d, { ...metric, key: 'plan.id' }));
    d = result(addDataset(d, { ...dataset, source: '' }));
    d = result(addCondition(d, { ...condition, baseline: false }));
    d = result(addCondition(d, { ...condition, baseline: false }));
    d.variables.push({ ...variable, id: 'v-2', metric: null }, { ...variable, id: 'v-3', metric: 'm-99' });
    d.hypotheses.push({ ...d.hypotheses[0]!, id: 'h-2', dependent: ['v-2', 'v-99'], independent: ['v-2'] });
    expect(new Set(checkChain(d).map((f) => f.rule))).toEqual(
      new Set(['CH-01', 'CH-02', 'CH-03', 'CH-04', 'CH-05', 'CH-06', 'CH-07', 'CH-08', 'CH-09']),
    );
  });
});
