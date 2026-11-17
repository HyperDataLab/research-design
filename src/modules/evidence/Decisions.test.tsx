import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import facts from '../../../schemas/vendor/experiment-facts-v1.example.json';
import model from '../../../schemas/vendor/paper-model-v1.example.json';
import { addPaper, decide, emptyPapersDoc } from '@/core/papers/papers';
import { setupClient } from '@/modules/corpus/testSupport';
import { ApiError } from '@/shared/api/client';
import { ProjectContext } from '@/shared/project/projectContext';
import { ToastProvider } from '@/shared/ui/ToastProvider';
import Page from './Page';

const ids = ['p-012345abcdef', 'p-abcdef012345'];
const missingFacts = {
  ...facts,
  facts: facts.facts.map((fact, index) =>
    index === 1 ? { ...fact, sentenceKeys: ['missing#1'], tableCell: null } : fact,
  ),
};

function setup(options: { missing?: boolean; second?: boolean; decided?: boolean } = {}) {
  const context = setupClient();
  let papers = emptyPapersDoc();
  for (const [index, id] of ids.entries()) {
    if (index === 1 && !options.second) break;
    const added = addPaper(
      papers,
      { title: `Paper ${index + 1}`, authors: [], year: null, venue: null, doi: null },
      'person',
      '2026-01-01T00:00:00Z',
      id,
    );
    if (!added.ok) throw Error('Could not add paper');
    const included = decide(added.doc, id, 'included', null, 'person', '2026-01-01T00:00:00Z');
    if (!included.ok) throw Error('Could not include paper');
    papers = included.doc;
    context.items.set(`${context.project.id}/facts/${id}`, {
      etag: '1',
      data: {
        schemaVersion: 1,
        paperId: id,
        source: { paperlabId: 'p', etag: 'e', fetchedBy: 'person', fetchedAt: '2026-01-01T00:00:00Z' },
        facts: options.missing && index === 0 ? missingFacts : facts,
        decisions: options.decided
          ? { 'fact-1': { decision: 'use', reason: null, by: 'person', at: '2026-01-01T00:00:00.000Z' } }
          : {},
      },
    });
    context.items.set(`${context.project.id}/paper-models/${id}`, { etag: '1', data: model });
  }
  context.docs.set(`${context.project.id}/papers`, { data: papers, etag: '1' });
  render(
    <MemoryRouter>
      <context.wrapper>
        <ProjectContext.Provider value={{ project: context.project, readOnly: false }}>
          <ToastProvider>
            <Page />
          </ToastProvider>
        </ProjectContext.Provider>
      </context.wrapper>
    </MemoryRouter>,
  );
  return context;
}

async function openFact(value: string) {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(value) }));
}

it('shows a found sentence as a quote and reports a missing sentence', async () => {
  setup({ missing: true });
  await openFact('Accuracy');
  const sentence = model.sentences.find((entry) => entry.key === facts.facts[0]!.sentenceKeys[0])!;
  await screen.findByText(sentence.text);
  expect(screen.getByText(sentence.text).closest('blockquote')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /đóng/i }));
  await openFact('Baseline');
  expect(await screen.findAllByText(/Không tìm thấy trong paper model đang giữ/)).not.toHaveLength(0);
  expect(screen.getByText(/missing#1/)).toBeInTheDocument();
});

it('FR-302 disables Dùng when no anchor is found', async () => {
  setup({ missing: true });
  await openFact('Baseline');
  await screen.findByText(/missing#1/);
  expect(screen.getByRole('button', { name: 'Dùng' })).toBeDisabled();
});

it('FR-303 requires an exclusion reason and preserves the stored facts', async () => {
  const context = setup();
  await openFact('Accuracy');
  fireEvent.click(screen.getByRole('button', { name: 'Loại' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận loại' }));
  expect(await screen.findByText('Cần ghi lý do khi loại.')).toBeInTheDocument();
  expect(context.api.putItem).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Lý do loại'), { target: { value: 'Not relevant' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận loại' }));
  await waitFor(() => expect(context.api.putItem).toHaveBeenCalledTimes(1));
  const written = vi.mocked(context.api.putItem).mock.calls[0]![3] as {
    facts: typeof facts;
    decisions: Record<string, { decision: string; reason: string; by: string; at: string }>;
  };
  expect(written.facts).toEqual(facts);
  expect(written.decisions['fact-1']).toEqual({
    decision: 'exclude',
    reason: 'Not relevant',
    by: context.auth.user!.email,
    at: expect.any(String),
  });
  const at = written.decisions['fact-1']!.at;
  expect(new Date(at).toISOString()).toBe(at);
});

it('Bỏ quyết định removes the stored decision', async () => {
  const context = setup({ decided: true });
  await openFact('Accuracy');
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ quyết định' }));
  await waitFor(() => expect(context.api.putItem).toHaveBeenCalledTimes(1));
  expect(vi.mocked(context.api.putItem).mock.calls[0]![3]).toMatchObject({ decisions: {} });
});

it('bulk Dùng refuses all writes when a selected fact has no anchor', async () => {
  const context = setup({ missing: true });
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Chọn Accuracy' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn Baseline' }));
  fireEvent.click(screen.getByRole('button', { name: 'Dùng' }));
  expect(
    await screen.findByText('Có dữ kiện không tìm thấy neo trong paper model đang giữ nên chưa thể dùng.'),
  ).toBeInTheDocument();
  expect(context.api.putItem).not.toHaveBeenCalled();
});

it('bulk Dùng writes anchored facts in two papers', async () => {
  const context = setup({ second: true });
  const rows = await screen.findAllByRole('row');
  fireEvent.click(within(rows[1]!).getByRole('checkbox', { name: 'Chọn Accuracy' }));
  fireEvent.click(within(rows[2]!).getByRole('checkbox', { name: 'Chọn Accuracy' }));
  fireEvent.click(screen.getByRole('button', { name: 'Dùng' }));
  await waitFor(() => expect(context.api.putItem).toHaveBeenCalledTimes(2));
  expect(vi.mocked(context.api.putItem).mock.calls.map((call) => call[2])).toEqual(ids);
});

it('re-reads and retries once after a 412', async () => {
  const context = setup();
  vi.mocked(context.api.putItem).mockRejectedValueOnce(new ApiError(412, 'precondition_failed', 'conflict'));
  await openFact('Accuracy');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Dùng' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Dùng' }));
  await waitFor(() => expect(context.api.putItem).toHaveBeenCalledTimes(2));
  expect(vi.mocked(context.api.getItem).mock.calls.filter((call) => call[1] === 'facts')).toHaveLength(2);
});

it('shows a conflict after a second 412', async () => {
  const context = setup();
  vi.mocked(context.api.putItem).mockRejectedValue(new ApiError(412, 'precondition_failed', 'conflict'));
  await openFact('Accuracy');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Dùng' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Dùng' }));
  expect(await screen.findByText('Dữ kiện vừa được người khác thay đổi; hãy thử lại.')).toBeInTheDocument();
  expect(context.api.putItem).toHaveBeenCalledTimes(2);
  expect(vi.mocked(context.api.getItem).mock.calls.filter((call) => call[1] === 'facts')).toHaveLength(2);
});

it('shows the table cell coordinates and headers when its block exists', async () => {
  setup();
  await openFact('Baseline');
  expect(await screen.findByText('Bảng, hàng 1, cột 1')).toBeInTheDocument();
  expect(screen.getByText('Baseline Accuracy (%)')).toBeInTheDocument();
});

it('FR-303 bulk Dùng across two papers writes nothing when a later paper has an unanchored fact', async () => {
  const context = setup({ missing: true, second: true });
  const rows = await screen.findAllByRole('row');
  fireEvent.click(within(rows[2]!).getByRole('checkbox', { name: 'Chọn Accuracy' }));
  fireEvent.click(within(rows[1]!).getByRole('checkbox', { name: 'Chọn Baseline' }));
  fireEvent.click(screen.getByRole('button', { name: 'Dùng' }));
  expect(
    await screen.findByText('Có dữ kiện không tìm thấy neo trong paper model đang giữ nên chưa thể dùng.'),
  ).toBeInTheDocument();
  expect(context.api.putItem).not.toHaveBeenCalled();
});

it('lists included papers only', async () => {
  const context = setupClient();
  let papers = emptyPapersDoc();
  for (const [index, id] of ids.entries()) {
    const added = addPaper(
      papers,
      { title: `Paper ${index + 1}`, authors: [], year: null, venue: null, doi: null },
      'person',
      '2026-01-01T00:00:00Z',
      id,
    );
    if (!added.ok) throw Error('Could not add paper');
    papers = added.doc;
  }
  const included = decide(papers, ids[0]!, 'included', null, 'person', '2026-01-01T00:00:00Z');
  if (!included.ok) throw Error('Could not include paper');
  context.docs.set(`${context.project.id}/papers`, { data: included.doc, etag: '1' });
  render(
    <MemoryRouter>
      <context.wrapper>
        <ProjectContext.Provider value={{ project: context.project, readOnly: false }}>
          <ToastProvider>
            <Page />
          </ToastProvider>
        </ProjectContext.Provider>
      </context.wrapper>
    </MemoryRouter>,
  );
  expect(await screen.findByText('Paper 1')).toBeInTheDocument();
  expect(screen.queryByText('Paper 2')).toBeNull();
});
