import example from '../../../schemas/vendor/experiment-facts-v1.example.json';
import { readExperimentFacts } from './experimentFacts';

describe('FR-301 experiment facts', () => {
  it('accepts the vendored invented example without changing it', () => {
    const input = structuredClone(example);
    const result = readExperimentFacts(input);
    expect(result).toEqual({ ok: true, facts: input });
  });
  it('refuses other formats and versions before validation', () => {
    expect(readExperimentFacts(null)).toEqual({ ok: false, reason: 'not_experiment_facts', issues: [] });
    expect(readExperimentFacts({ format: 'paperlab-experiment-facts', schemaVersion: 2 })).toEqual({
      ok: false,
      reason: 'unsupported_version',
      issues: ['schemaVersion 2'],
    });
  });
  it('refuses invalid schema data and an absent anchor', () => {
    expect(readExperimentFacts({ ...example, extra: true })).toMatchObject({ ok: false, reason: 'invalid' });
    const input = structuredClone(example);
    input.facts[0]!.sentenceKeys = [];
    input.facts[0]!.tableCell = null as unknown as (typeof input.facts)[0]['tableCell'];
    expect(readExperimentFacts(input)).toMatchObject({ ok: false, reason: 'invalid' });
  });
});
