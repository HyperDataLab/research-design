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
  it('MO-04 a variable that is no longer measured drops its metric', () => {
    const metric = {
      name: 'Score',
      key: '',
      unit: '',
      goal: null,
      aggregation: null,
      protocol: '',
      bank: null,
      protocolBank: null,
    };
    let d = emptyDraft();
    const m = addMetric(d, metric);
    if (!m.ok) throw Error(m.error);
    const v = addVariable(m.doc, {
      name: 'Outcome',
      role: 'dependent',
      construct: '',
      metric: 'm-1',
      levels: [],
    });
    if (!v.ok) throw Error(v.error);
    const e = editVariable(v.doc, 'v-1', {
      name: 'Outcome',
      role: 'independent',
      construct: '',
      metric: 'm-1',
      levels: ['a', 'b'],
    });
    if (!e.ok) throw Error(e.error);
    d = e.doc;
    expect(d.variables[0]?.metric).toBeNull();
    // Still listed as dependent by nothing here; a wrong-role variable is CH-03's business, not CH-02's.
    expect(
      checkChain({
        ...d,
        hypotheses: [
          {
            id: 'h-1',
            statement: 'H',
            kind: 'directional',
            question: null,
            claim: null,
            independent: [],
            dependent: ['v-1'],
          },
        ],
      }).map((f) => f.rule),
    ).toEqual(['CH-03', 'CH-04']);
    expect(removeMetric(d, 'm-1').ok).toBe(true);
  });
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
  it('CH-01 flags a hypothesis without a dependent variable until linked', () => {
    let d = result(
      addHypothesis(emptyDraft(), { statement: 'Test', kind: 'exploratory', question: null, claim: null }),
    );
    expect(checkChain(d).some((f) => f.rule === 'CH-01')).toBe(true);
    d = result(addVariable(d, variable));
    d = result(setHypothesisVariables(d, 'h-1', { independent: [], dependent: ['v-1'] }));
    expect(checkChain(d).some((f) => f.rule === 'CH-01')).toBe(false);
  });
  it('CH-02 flags a dependent variable without a metric until linked', () => {
    let d = result(
      addHypothesis(emptyDraft(), { statement: 'Test', kind: 'exploratory', question: null, claim: null }),
    );
    d = result(addVariable(d, variable));
    d = result(setHypothesisVariables(d, 'h-1', { independent: [], dependent: ['v-1'] }));
    expect(checkChain(d).some((f) => f.rule === 'CH-02')).toBe(true);
    d = result(addMetric(d, metric));
    d = result(editVariable(d, 'v-1', { ...variable, metric: 'm-1' }));
    expect(checkChain(d).some((f) => f.rule === 'CH-02')).toBe(false);
  });
  it('CH-03 flags missing and wrong-role variables until corrected', () => {
    let d = result(
      addHypothesis(emptyDraft(), { statement: 'Test', kind: 'exploratory', question: null, claim: null }),
    );
    d = result(addVariable(d, variable));
    d.hypotheses[0]!.independent = ['v-1', 'v-99'];
    expect(checkChain(d).filter((f) => f.rule === 'CH-03')).toHaveLength(2);
    d.hypotheses[0]!.independent = [];
    expect(checkChain(d).some((f) => f.rule === 'CH-03')).toBe(false);
  });
  it('CH-04 flags missing metric fields until filled', () => {
    let d = result(
      addMetric(emptyDraft(), { ...metric, key: '', unit: '', goal: null, aggregation: null, protocol: '' }),
    );
    expect(checkChain(d).find((f) => f.rule === 'CH-04')).toMatchObject({
      missing: ['key', 'unit', 'goal', 'aggregation', 'protocol'],
    });
    d = result(editMetric(d, 'm-1', metric));
    expect(checkChain(d).some((f) => f.rule === 'CH-04')).toBe(false);
  });
  it('CH-05 ignores empty keys and flags duplicates and reserved keys until corrected', () => {
    let d = result(addMetric(emptyDraft(), { ...metric, key: '' }));
    d = result(addMetric(d, { ...metric, key: '' }));
    expect(checkChain(d).some((f) => f.rule === 'CH-05')).toBe(false);
    d = result(editMetric(d, 'm-1', { ...metric, key: 'plan.id' }));
    d = result(editMetric(d, 'm-2', { ...metric, key: 'plan.id' }));
    expect(checkChain(d).filter((f) => f.rule === 'CH-05')).toHaveLength(4);
    d = result(editMetric(d, 'm-1', { ...metric, key: 'test/one' }));
    d = result(editMetric(d, 'm-2', { ...metric, key: 'test/two' }));
    expect(checkChain(d).some((f) => f.rule === 'CH-05')).toBe(false);
  });
  it('CH-06 flags an independent variable with too few levels until filled', () => {
    let d = result(addVariable(emptyDraft(), { ...variable, role: 'independent' }));
    expect(checkChain(d).some((f) => f.rule === 'CH-06')).toBe(true);
    d = result(editVariable(d, 'v-1', { ...variable, role: 'independent', levels: ['one', 'two'] }));
    expect(checkChain(d).some((f) => f.rule === 'CH-06')).toBe(false);
  });
  it('CH-07 flags a dataset without a source until filled', () => {
    let d = result(addDataset(emptyDraft(), { ...dataset, source: '' }));
    expect(checkChain(d).some((f) => f.rule === 'CH-07')).toBe(true);
    d = result(editDataset(d, 'd-1', dataset));
    expect(checkChain(d).some((f) => f.rule === 'CH-07')).toBe(false);
  });
  it('CH-08 flags a missing metric reference until removed', () => {
    const d = result(addVariable(emptyDraft(), variable));
    d.variables[0]!.metric = 'm-99';
    expect(checkChain(d).some((f) => f.rule === 'CH-08')).toBe(true);
    d.variables[0]!.metric = null;
    expect(checkChain(d).some((f) => f.rule === 'CH-08')).toBe(false);
  });
});
