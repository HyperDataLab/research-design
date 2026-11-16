import { describe, expect, it } from 'vitest';
import { emptyDraft } from './schema';
import { freezeGate, samePlanContent, nextVersion } from './freezeGate';
import { draftToPlan } from './toPlan';

const meta = {
  planId: 'project',
  planVersion: 1,
  title: 'Plan',
  frozenAt: '2026-11-16T09:00:00Z',
  frozenBy: 'a@hyperdatalab.org',
  deviation: null,
  appVersion: '1',
};
function complete() {
  const d = emptyDraft();
  d.questions = [{ id: 'q-1', text: 'Question', gap: 'Gap', papers: [] }];
  d.hypotheses = [
    {
      id: 'h-1',
      statement: 'Hypothesis',
      kind: 'exploratory',
      question: 'q-1',
      claim: 'ct.causal',
      independent: [],
      dependent: ['v-1'],
    },
  ];
  d.variables = [
    { id: 'v-1', name: 'Variable', role: 'dependent', construct: 'Construct', metric: 'm-1', levels: [] },
  ];
  d.metrics = [
    {
      id: 'm-1',
      name: 'Metric',
      key: 'score',
      unit: 'points',
      goal: 'maximize',
      aggregation: 'mean',
      protocol: 'Measure',
      bank: null,
      protocolBank: { id: 'p', release: '1' },
    },
  ];
  d.datasets = [
    {
      id: 'd-1',
      name: 'Dataset',
      source: 'Source',
      version: null,
      split: null,
      sha256: null,
      benchmark: null,
    },
  ];
  d.conditions = [{ id: 'c-1', name: 'Condition', baseline: true, params: {} }];
  d.runMatrix = {
    mlflowExperiment: 'Experiment',
    conditions: ['c-1'],
    datasets: ['d-1'],
    seeds: [1],
    sampleSizeJustification: 'Prior work',
  };
  return d;
}
describe('freeze gate', () => {
  it('TP-03 maps context including only included papers', () => {
    const d = complete();
    d.design = { name: 'Design', assignment: 'random', bank: null };
    d.threats = [{ id: 't-1', name: 'Threat', mitigation: 'Mitigate', bank: null }];
    const paper = {
      id: 'p-000000000001',
      title: 'Paper',
      authors: [],
      year: null,
      venue: null,
      doi: null,
      decision: 'included' as const,
      reason: null,
      addedBy: 'a',
      addedAt: meta.frozenAt,
      model: null,
    };
    const result = draftToPlan(d, meta, {
      schemaVersion: 1,
      papers: [paper, { ...paper, id: 'p-000000000002', decision: 'undecided' }],
      log: [],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.context).toMatchObject({
      questions: [{ id: 'q-1', gap: 'Gap', hypotheses: ['h-1'] }],
      design: d.design,
      threats: [{ name: 'Threat', mitigation: 'Mitigate' }],
      sources: [{ title: 'Paper', sourceHash: null }],
      claims: [{ hypothesis: 'h-1', claimType: 'ct.causal' }],
      constructs: [{ variable: 'v-1', construct: 'Construct' }],
      metricProtocols: [{ metric: 'm-1', protocol: { id: 'p', release: '1' } }],
    });
  });
  it('FG-01 maps incomplete drafts to actionable missing items', () => {
    const gate = freezeGate(emptyDraft(), meta, undefined, null);
    expect(gate.state).toBe('not_a_plan');
    if (gate.state === 'not_a_plan')
      expect(gate.missing.map((m) => m.code)).toEqual(
        expect.arrayContaining([
          'no_hypotheses',
          'no_variables',
          'no_metrics',
          'no_datasets',
          'no_conditions',
          'grid_incomplete',
        ]),
      );
  });
  it('FG-02 identifies all incomplete object fields', () => {
    const d = complete();
    d.hypotheses[0]!.dependent = [];
    Object.assign(d.metrics[0]!, { key: '', unit: '', goal: null, aggregation: null, protocol: '' });
    d.datasets[0]!.source = '';
    d.design = { name: 'Design', assignment: null, bank: null };
    d.threats = [{ id: 't-1', name: 'Threat', mitigation: '', bank: null }];
    d.analyses = [
      {
        id: 'a-1',
        hypothesis: null,
        method: null,
        variables: [],
        conditions: [],
        parameters: {},
        assumptions: [],
        missingPolicy: 'fail',
        alpha: 0.05,
        correction: 'none',
      },
    ];
    const gate = freezeGate(d, meta, undefined, null);
    expect(gate.state).toBe('not_a_plan');
    if (gate.state === 'not_a_plan')
      expect(gate.missing.map((m) => m.code)).toEqual(
        expect.arrayContaining([
          'hypothesis_without_dependent',
          'metric_incomplete',
          'dataset_without_source',
          'analysis_without_method',
          'analysis_without_variables',
          'design_without_assignment',
          'threat_without_mitigation',
        ]),
      );
  });
  it('FG-03 detects unchanged content and ignores metadata and key order', () => {
    const d = complete();
    const gate = freezeGate(d, meta, undefined, null);
    expect(gate.state).toBe('plan');
    if (gate.state !== 'plan') return;
    expect(gate.blocked).toBe(false);
    const copy = {
      ...gate.plan,
      planVersion: 2,
      frozenAt: '2027-01-01T00:00:00Z',
      frozenBy: 'b',
      deviation: 'Changed',
      generator: { version: '2', app: 'research-design' as const },
    };
    expect(samePlanContent(gate.plan, copy)).toBe(true);
    expect(freezeGate(d, meta, undefined, copy)).toMatchObject({ unchanged: true });
    d.questions[0]!.text = 'Edited';
    expect(freezeGate(d, meta, undefined, copy)).toMatchObject({ unchanged: false });
    expect(nextVersion([2, 1])).toBe(3);
  });
  it('FG-04 reports unexplained mapping failures as other', () => {
    const gate = freezeGate(complete(), { ...meta, title: '' }, undefined, null);
    expect(gate).toMatchObject({
      state: 'not_a_plan',
      missing: [{ code: 'other', text: expect.stringContaining('title:') }],
    });
  });
});
