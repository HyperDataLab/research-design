import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { emptyDraft, type Draft } from '@/core/draft/schema';
import { ChainLine } from './ChainLine';

afterEach(cleanup);
it('CH-UI renders a complete chain and each missing link', () => {
  const draft: Draft = {
    ...emptyDraft(),
    hypotheses: [
      {
        id: 'h-1',
        statement: 'Test',
        kind: 'exploratory',
        question: null,
        claim: null,
        independent: [],
        dependent: [],
      },
    ],
  };
  const show = () =>
    render(
      <MemoryRouter>
        <ChainLine draft={draft} hypothesisId="h-1" projectId="project" />
      </MemoryRouter>,
    );
  let view = show();
  expect(screen.getByText('chưa gắn biến phụ thuộc')).toBeTruthy();
  view.unmount();
  draft.hypotheses[0]!.dependent = ['v-1'];
  draft.variables.push({
    id: 'v-1',
    name: 'Test score',
    role: 'dependent',
    construct: '',
    metric: null,
    levels: [],
  });
  view = show();
  expect(screen.getByText('chưa có metric')).toBeTruthy();
  view.unmount();
  draft.variables[0]!.metric = 'm-1';
  draft.metrics.push({
    id: 'm-1',
    name: 'Test metric',
    key: '',
    unit: '',
    goal: null,
    aggregation: null,
    protocol: '',
    bank: null,
    protocolBank: null,
  });
  view = show();
  expect(screen.getByText('metric chưa có key')).toBeTruthy();
  view.unmount();
  draft.metrics[0]!.key = 'test/score';
  show();
  expect(screen.getByText('test/score')).toBeTruthy();
  expect(screen.getByText('v-1').closest('a')?.getAttribute('href')).toBe(
    '/p/project/measurement?tab=variables',
  );
  expect(screen.getByText('m-1').closest('a')?.getAttribute('href')).toBe(
    '/p/project/measurement?tab=metrics',
  );
});
it('AN-UI links an analysis and warns when a confirmatory hypothesis has none', () => {
  const draft = emptyDraft();
  draft.hypotheses.push({
    id: 'h-1',
    statement: 'Test',
    kind: 'directional',
    question: null,
    claim: null,
    independent: [],
    dependent: [],
  });
  const show = () =>
    render(
      <MemoryRouter>
        <ChainLine draft={draft} hypothesisId="h-1" projectId="project" />
      </MemoryRouter>,
    );
  const view = show();
  expect(screen.getByText('chưa có phân tích')).toBeInTheDocument();
  view.unmount();
  draft.analyses.push({
    id: 'a-1',
    hypothesis: 'h-1',
    method: 'ttest_welch',
    variables: [],
    conditions: [],
    parameters: {},
    assumptions: [],
    missingPolicy: 'listwise',
    alpha: 0.05,
    correction: 'none',
  });
  show();
  expect(screen.getByText('a-1').closest('a')).toHaveAttribute('href', '/p/project/analyses');
  expect(screen.getByText(/kiểm định t Welch/)).toBeInTheDocument();
});
