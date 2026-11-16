import { expect, it } from 'vitest';
import { examplePlan } from './examplePlan';
import { planMarkdown } from './planMarkdown';

it('PM-01 includes all sections and is deterministic', () => {
  const plan = examplePlan();
  const text = planMarkdown(plan);
  for (const section of [
    'Questions',
    'Hypotheses',
    'Design and threats',
    'Variables',
    'Metrics',
    'Datasets',
    'Conditions',
    'Run matrix',
    'Analyses',
    'Sources',
  ])
    expect(text).toContain(`## ${section}`);
  expect(planMarkdown(plan)).toBe(text);
});
it('PM-02 escapes table delimiters and newlines', () => {
  const plan = examplePlan();
  plan.hypotheses[0]!.statement = 'one | two\nthree';
  expect(planMarkdown(plan)).toContain('one \\| two<br>three');
});
it('PM-03 omits context sections when absent', () => {
  const plan = examplePlan();
  plan.context = null;
  expect(planMarkdown(plan)).not.toContain('## Questions');
  expect(planMarkdown(plan)).toContain('## Hypotheses');
});
