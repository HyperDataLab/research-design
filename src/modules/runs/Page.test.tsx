import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { emptyDraft, type Draft } from '@/core/draft/schema';
import { ProjectContext } from '@/shared/project/projectContext';
import { ToastProvider } from '@/shared/ui/ToastProvider';
import { setupClient } from '../corpus/testSupport';
import Page from './Page';

function fixture() {
  const draft = emptyDraft();
  draft.conditions = [
    { id: 'c-1', name: 'Control', baseline: true, params: {} },
    { id: 'c-2', name: 'Treatment', baseline: false, params: {} },
  ];
  draft.datasets = [
    {
      id: 'd-1',
      name: 'Sample',
      source: 'Invented',
      version: null,
      split: null,
      sha256: null,
      benchmark: null,
    },
  ];
  return draft;
}
function setup(draft: Draft = fixture(), readOnly = false, failing = false) {
  const context = setupClient();
  context.docs.set(`${context.project.id}/draft`, { etag: 'draft', data: draft });
  if (failing) vi.mocked(context.api.getDoc).mockRejectedValue(new Error('offline'));
  render(
    <context.wrapper>
      <ProjectContext.Provider value={{ project: context.project, readOnly }}>
        <ToastProvider>
          <MemoryRouter>
            <Page />
          </MemoryRouter>
        </ToastProvider>
      </ProjectContext.Provider>
    </context.wrapper>,
  );
  return context;
}
it('RN-01 saves a grid and counts the saved cells', async () => {
  const context = setup();
  fireEvent.click(await screen.findByLabelText(/c-1 Control/));
  fireEvent.click(screen.getByLabelText(/d-1 Sample/));
  fireEvent.change(screen.getByLabelText('Seed'), { target: { value: '0-4' } });
  expect(screen.getByText('Chưa đủ để tính số lần chạy.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Lưu lưới' }));
  expect(await screen.findByText('1 điều kiện × 1 dataset × 5 seed = 5 lần chạy')).toBeInTheDocument();
  expect((context.docs.get(`${context.project.id}/draft`)?.data as Draft).runMatrix.seeds).toEqual([
    0, 1, 2, 3, 4,
  ]);
});
it('RN-02 parses ranges and displays the list', async () => {
  setup();
  fireEvent.change(await screen.findByLabelText('Seed'), { target: { value: '0-4, 7' } });
  expect(screen.getByText('0, 1, 2, 3, 4, 7 · 6 seed')).toBeInTheDocument();
});
it('RN-03 refuses invalid seeds', async () => {
  setup();
  fireEvent.change(await screen.findByLabelText('Seed'), { target: { value: '-1' } });
  expect(screen.getByText('Seed là các số nguyên không âm hoặc khoảng, ví dụ 0-4, 7.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Lưu lưới' })).toBeDisabled();
});
it('RN-04 refuses more than 200 seeds', async () => {
  setup();
  fireEvent.change(await screen.findByLabelText('Seed'), { target: { value: '0-200' } });
  expect(screen.getByText('Tối đa 200 seed.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Lưu lưới' })).toBeDisabled();
});
it('RN-05 previews the first 20 cells and their tags', async () => {
  const draft = fixture();
  draft.runMatrix = {
    mlflowExperiment: 'Experiment',
    conditions: ['c-1'],
    datasets: ['d-1'],
    seeds: Array.from({ length: 23 }, (_, i) => i),
    sampleSizeJustification: 'Enough',
  };
  setup(draft);
  const table = await screen.findByRole('table');
  expect(within(table).getByText('plan.condition_id')).toBeInTheDocument();
  expect(within(table).getByText('plan.dataset_id')).toBeInTheDocument();
  expect(within(table).getByText('plan.seed')).toBeInTheDocument();
  expect(within(table).getAllByRole('row')).toHaveLength(21);
  const cells = within(within(table).getAllByRole('row')[1]!).getAllByRole('cell');
  expect(cells[0]).toHaveTextContent('c-1 Control');
  expect(cells[1]).toHaveTextContent('d-1 Sample');
  expect(cells[0]!.firstElementChild?.className).toMatch(/mono/);
  expect(cells[1]!.firstElementChild?.className).toMatch(/mono/);
  expect(screen.getByText('… và 3 ô nữa')).toBeInTheDocument();
});
it('RN-06 warns when the selected conditions lack a baseline', async () => {
  const draft = fixture();
  draft.conditions.push({ id: 'c-3', name: 'Alternative', baseline: false, params: {} });
  draft.runMatrix.conditions = ['c-2', 'c-3'];
  setup(draft);
  expect(await screen.findByText('Lưới chạy có nhiều điều kiện nhưng chưa có baseline.')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/c-1 Control/));
  fireEvent.click(screen.getByRole('button', { name: 'Lưu lưới' }));
  await waitFor(() =>
    expect(
      screen.queryByText('Lưới chạy có nhiều điều kiện nhưng chưa có baseline.'),
    ).not.toBeInTheDocument(),
  );
});
it('RN-07 shows analysis conditions outside the grid', async () => {
  const draft = fixture();
  draft.analyses.push({
    id: 'a-1',
    hypothesis: null,
    method: null,
    variables: [],
    conditions: ['c-2'],
    parameters: {},
    assumptions: [],
    missingPolicy: 'listwise',
    alpha: 0.05,
    correction: 'none',
  });
  setup(draft);
  expect(
    await screen.findByText('a-1 so sánh c-2 «Treatment», điều kiện không nằm trong lưới chạy.'),
  ).toBeInTheDocument();
});
it('RN-08 links empty conditions and datasets to measurement', async () => {
  const context = setup(emptyDraft());
  const links = await screen.findAllByRole('link', { name: 'Thêm ở màn Đo lường.' });
  expect(links[0]).toHaveAttribute('href', `/p/${context.project.id}/measurement?tab=conditions`);
  expect(links[1]).toHaveAttribute('href', `/p/${context.project.id}/measurement?tab=datasets`);
  expect(screen.getByText(/Chưa có điều kiện nào/)).toBeInTheDocument();
  expect(screen.getByText(/Chưa có dataset nào/)).toBeInTheDocument();
  expect(screen.getByText(/Lưới chạy còn thiếu:/)).toBeInTheDocument();
});
it('RN-09 shows archived data without write controls', async () => {
  setup(fixture(), true);
  expect(await screen.findByText('Đã lưu trữ · chỉ đọc')).toBeInTheDocument();
  await screen.findByText('Lưới chạy');
  expect(screen.queryByRole('button', { name: 'Lưu lưới' })).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
it('RN-10 shows loading and offers retry after an error', async () => {
  setup(fixture(), false, true);
  expect(screen.getByText('Đang tải…')).toBeInTheDocument();
  expect(await screen.findByText('Không tải được ma trận chạy.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
});

it('RN-11 shows the current grid when a selected condition was removed elsewhere', async () => {
  const draft = fixture();
  const context = setup(draft);
  fireEvent.click(await screen.findByLabelText(/c-2 Treatment/));
  const updated = fixture();
  updated.conditions = updated.conditions.filter((item) => item.id !== 'c-2');
  context.docs.set(`${context.project.id}/draft`, { etag: 'newer', data: updated });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu lưới' }));
  expect(
    await screen.findByText('Lưới chạy đã thay đổi và không thể lưu. Vui lòng kiểm tra lại.'),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText(/c-2 Treatment/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Lưu lưới' })).toBeDisabled();
});
