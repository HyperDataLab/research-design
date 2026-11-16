import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { emptyDraft, type Draft } from '@/core/draft/schema';
import { ProjectContext } from '@/shared/project/projectContext';
import { setupClient } from '../corpus/testSupport';
import Page from './Page';

function fixture() {
  const draft = emptyDraft();
  draft.hypotheses.push({
    id: 'h-1',
    statement: 'Invented hypothesis',
    kind: 'directional',
    question: null,
    claim: null,
    independent: [],
    dependent: ['v-1'],
  });
  draft.variables.push({
    id: 'v-1',
    name: 'Score',
    role: 'dependent',
    construct: '',
    metric: null,
    levels: [],
  });
  draft.conditions.push(
    ...['One', 'Two', 'Three'].map((name, i) => ({ id: `c-${i + 1}`, name, baseline: false, params: {} })),
  );
  return draft;
}
function setup(draft = fixture(), readOnly = false) {
  const context = setupClient();
  context.docs.set(`${context.project.id}/draft`, { etag: 'draft', data: draft });
  render(
    <context.wrapper>
      <ProjectContext.Provider value={{ project: context.project, readOnly }}>
        <MemoryRouter>
          <Page />
        </MemoryRouter>
      </ProjectContext.Provider>
    </context.wrapper>,
  );
  return context;
}
const analysis = (): Draft['analyses'][number] => ({
  id: 'a-1',
  hypothesis: 'h-1',
  method: 'ttest_welch',
  variables: ['v-1'],
  conditions: ['c-1', 'c-2', 'c-3'],
  parameters: {},
  assumptions: [],
  missingPolicy: 'listwise',
  alpha: 0.05,
  correction: 'none',
});

it('AS-01 adds an analysis with dependent variables ticked and keeps condition order', async () => {
  const context = setup();
  fireEvent.click((await screen.findAllByRole('button', { name: 'Thêm phân tích' }))[0]!);
  expect(screen.getByLabelText('v-1 Score')).toBeChecked();
  fireEvent.change(screen.getByLabelText('Thêm điều kiện'), { target: { value: 'c-1' } });
  fireEvent.change(screen.getByLabelText('Thêm điều kiện'), { target: { value: 'c-2' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Lên' })[1]!);
  fireEvent.click(screen.getAllByRole('button', { name: 'Xuống' })[0]!);
  fireEvent.click(screen.getAllByRole('button', { name: 'Lên' })[1]!);
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect((context.docs.get(`${context.project.id}/draft`)?.data as Draft).analyses[0]).toMatchObject({
    variables: ['v-1'],
    conditions: ['c-2', 'c-1'],
    alpha: 0.05,
    correction: 'none',
    missingPolicy: 'listwise',
  });
});
it('AS-02 shows AN-04 and the P1 note', async () => {
  const draft = fixture();
  draft.analyses.push(analysis(), { ...analysis(), id: 'a-2', method: 'anova_oneway' });
  setup(draft);
  expect(
    await screen.findByText(/phương pháp so sánh đúng hai điều kiện, nhưng đang có 3/),
  ).toBeInTheDocument();
  expect(screen.getByText('SRD chưa hỗ trợ')).toBeInTheDocument();
});
it('AS-03 shows AN-01 only for a non-exploratory hypothesis', async () => {
  const draft = fixture();
  draft.hypotheses.push({ ...draft.hypotheses[0]!, id: 'h-2', kind: 'exploratory' });
  setup(draft);
  expect(await screen.findByText('h-1 chưa có phân tích nào.')).toBeInTheDocument();
  expect(screen.queryByText('h-2 chưa có phân tích nào.')).not.toBeInTheDocument();
});
it('AS-04 refuses invalid alpha', async () => {
  setup();
  fireEvent.click((await screen.findAllByRole('button', { name: 'Thêm phân tích' }))[0]!);
  fireEvent.change(screen.getByLabelText('α'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  expect(screen.getByText('α phải là số lớn hơn 0 và nhỏ hơn 1.')).toBeInTheDocument();
});
it('AS-05 displays unattached analyses and deletes with confirmation', async () => {
  const draft = fixture();
  draft.analyses.push({ ...analysis(), hypothesis: null });
  const context = setup(draft);
  const card = (await screen.findByText('Không gắn giả thuyết')).closest('section')!;
  expect(within(card).getByText('a-1')).toBeInTheDocument();
  fireEvent.click(within(card).getByRole('button', { name: 'Xoá' }));
  const dialog = screen.getByRole('alertdialog');
  expect(within(dialog).getByText('Xoá a-1?')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xoá' }));
  await waitFor(() =>
    expect((context.docs.get(`${context.project.id}/draft`)?.data as Draft).analyses).toHaveLength(0),
  );
});
it('AS-06 shows archived and empty states without write controls', async () => {
  setup(emptyDraft(), true);
  expect(await screen.findByText('Chưa có giả thuyết nào.')).toBeInTheDocument();
  expect(screen.getByText('Đã lưu trữ · chỉ đọc')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Thêm phân tích' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Thêm giả thuyết/ })).toHaveAttribute(
    'href',
    expect.stringContaining('/questions'),
  );
});

it('AS-07 shows loading and allows retry after an error', async () => {
  const context = setupClient();
  vi.mocked(context.api.getDoc).mockRejectedValueOnce(new Error('offline'));
  render(
    <context.wrapper>
      <MemoryRouter>
        <Page />
      </MemoryRouter>
    </context.wrapper>,
  );
  expect(screen.getByText(/Đang tải/)).toBeInTheDocument();
  expect(await screen.findByText('Không tải được phân tích thống kê.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText('Chưa có giả thuyết nào.')).toBeInTheDocument();
});

it('AS-08 links to measurement when no variables exist', async () => {
  const draft = fixture();
  draft.variables = [];
  draft.hypotheses[0]!.dependent = [];
  setup(draft);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Thêm phân tích' }))[0]!);
  expect(screen.getByText('Chưa có biến nào.', { exact: false })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Thêm biến ở màn Đo lường.' })).toHaveAttribute(
    'href',
    expect.stringContaining('/measurement?tab=variables'),
  );
});
