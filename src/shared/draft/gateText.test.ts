import { expect, it } from 'vitest';
import { emptyDraft } from '@/core/draft/schema';
import type { Missing } from '@/core/draft/freezeGate';
import { missingLink, missingText, ruleText } from './gateText';
it('GT-01 gives every rule and missing code Vietnamese text and a link', () => {
  for (let i = 1; i <= 10; i++)
    expect(ruleText(`PP-${String(i).padStart(2, '0')}`)).not.toContain('chưa được nhận diện');
  const codes: Missing['code'][] = [
    'no_hypotheses',
    'no_variables',
    'no_metrics',
    'no_datasets',
    'no_conditions',
    'hypothesis_without_dependent',
    'metric_incomplete',
    'dataset_without_source',
    'analysis_without_method',
    'analysis_without_variables',
    'grid_incomplete',
    'design_without_assignment',
    'threat_without_mitigation',
    'other',
  ];
  for (const code of codes) {
    expect(missingText({ code }, emptyDraft())).toMatch(/[à-ỹ]/i);
    expect(missingLink({ code }, 'project')).toMatch(/^\/p\/project\//);
  }
});

it('GT-02 uses shared field words and names missing objects', () => {
  const draft = emptyDraft();
  draft.metrics.push({
    id: 'm-1',
    name: 'Invented',
    key: '',
    unit: '',
    goal: null,
    aggregation: null,
    protocol: '',
    bank: null,
    protocolBank: null,
  });
  expect(missingText({ code: 'no_metrics' }, draft)).toBe('Chưa có metric nào.');
  expect(missingText({ code: 'metric_incomplete', subject: 'm-1', fields: ['key', 'unit'] }, draft)).toBe(
    'm-1 «Invented» còn thiếu: key, đơn vị.',
  );
  expect(missingText({ code: 'grid_incomplete', fields: ['mlflowExperiment', 'seeds'] }, draft)).toBe(
    'Lưới chạy còn thiếu: tên experiment, seed.',
  );
  expect(ruleText('PP-04')).toContain('metric');
});
