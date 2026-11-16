import { expect, it } from 'vitest';
import { word } from './words';
it('RD-10 translates all bank vocabulary and preserves unknown values', () => {
  const values: Record<string, string[]> = {
    family: [
      'experimental',
      'quasi_experimental',
      'observational',
      'computational',
      'qualitative',
      'mixed',
      'design_science',
      'synthesis',
      'replication',
      'formal',
    ],
    causalLicence: [
      'causal',
      'causal_under_stated_assumptions',
      'associational',
      'descriptive',
      'existence_proof',
      'deductive',
    ],
    validity: [
      'internal',
      'external',
      'construct',
      'statistical_conclusion',
      'credibility',
      'transferability',
      'dependability',
      'confirmability',
    ],
  };
  for (const [kind, entries] of Object.entries(values))
    for (const value of entries) expect(word(kind, value)).not.toBe(value);
  expect(word('family', 'unknown')).toBe('unknown');
});
