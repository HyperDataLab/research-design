import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { snapshot } from '@/core/bank/testSupport';
import { emptyDraft } from '@/core/draft/schema';
import { ProjectContext } from '@/shared/project/projectContext';
import { setupClient } from '../corpus/testSupport';
import Page from './Page';

function setup(
  options: { readOnly?: boolean; draft?: ReturnType<typeof emptyDraft>; bank?: boolean; fail?: boolean } = {},
) {
  const context = setupClient();
  if (options.draft) context.docs.set(`${context.project.id}/draft`, { data: options.draft, etag: '1' });
  if (options.bank)
    context.docs.set(`${context.project.id}/bank`, {
      etag: '2',
      data: {
        schemaVersion: 1,
        release: 'sha256:0123456789abcdef',
        source: 'Synthetic',
        importedBy: 'test',
        importedAt: '2026-01-01T00:00:00Z',
        collections: snapshot.collections,
      },
    });
  if (options.fail) vi.mocked(context.api.getDoc).mockRejectedValue(new Error('offline'));
  render(
    <MemoryRouter>
      <context.wrapper>
        <ProjectContext.Provider value={{ project: context.project, readOnly: !!options.readOnly }}>
          <Page />
        </ProjectContext.Provider>
      </context.wrapper>
    </MemoryRouter>,
  );
  return context;
}
it('DL-UI refuses deleting a hypothesis used by an analysis', async () => {
  const draft = emptyDraft();
  draft.hypotheses.push({
    id: 'h-1',
    statement: 'Invented',
    kind: 'directional',
    question: null,
    claim: null,
    independent: [],
    dependent: [],
  });
  draft.analyses.push({
    id: 'a-1',
    hypothesis: 'h-1',
    method: null,
    variables: [],
    conditions: [],
    parameters: {},
    assumptions: [],
    missingPolicy: 'listwise',
    alpha: 0.05,
    correction: 'none',
  });
  setup({ draft });
  fireEvent.click(await screen.findByRole('button', { name: 'Xoá' }));
  const dialog = screen.getByRole('alertdialog');
  expect(
    within(dialog).getByText('h-1 đang được dùng bởi a-1. Gỡ liên kết trước khi xoá.'),
  ).toBeInTheDocument();
  expect(within(dialog).queryByText('Xác nhận thao tác xoá.')).not.toBeInTheDocument();
  expect(within(dialog).queryByRole('button', { name: 'Xoá' })).not.toBeInTheDocument();
});
async function addQuestion() {
  fireEvent.click(await screen.findByRole('button', { name: 'Thêm câu hỏi' }));
  fireEvent.change(screen.getByLabelText('Câu hỏi'), { target: { value: 'Invented question' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  await screen.findByText('Invented question');
}
it('QH-01 adds a question and QH-02 renames without changing its id', async () => {
  setup();
  await addQuestion();
  fireEvent.click(screen.getByRole('button', { name: 'Sửa' }));
  fireEvent.change(screen.getByLabelText('Câu hỏi'), { target: { value: 'Renamed question' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  expect(await screen.findByText('Renamed question')).toBeInTheDocument();
  expect(screen.getByText('q-1')).toBeInTheDocument();
});
it('QH-03 adds a hypothesis and QH-05 refuses deletion of its question', async () => {
  setup();
  await addQuestion();
  fireEvent.click(screen.getByRole('button', { name: 'Thêm giả thuyết' }));
  fireEvent.change(screen.getByLabelText('Phát biểu'), { target: { value: 'Invented hypothesis' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  await screen.findByText('Invented hypothesis');
  fireEvent.click(screen.getAllByRole('button', { name: 'Xoá' })[0]!);
  expect(
    screen.getByText('Câu hỏi này còn 1 giả thuyết. Chuyển hoặc xoá các giả thuyết trước.'),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole('alertdialog')).queryByText('Xác nhận thao tác xoá.'),
  ).not.toBeInTheDocument();
  expect(
    within(screen.getByRole('alertdialog')).queryByRole('button', { name: 'Xoá' }),
  ).not.toBeInTheDocument();
});
it('QH-04 shows unattached hypotheses and QH-06 shows DS-01', async () => {
  const draft = emptyDraft();
  draft.design = {
    name: 'Test benchmark',
    assignment: null,
    bank: { id: 'rd.test-benchmark', release: 'sha256:0123456789abcdef' },
  };
  draft.hypotheses = [
    {
      id: 'h-1',
      statement: 'Synthetic claim',
      kind: 'directional',
      question: null,
      claim: 'ct.causal',
      independent: [],
      dependent: [],
    },
  ];
  setup({ draft, bank: true });
  expect(await screen.findByText('Chưa gắn câu hỏi')).toBeInTheDocument();
  expect(
    screen.getByText('h-1 là nhận định Causal; thiết kế «Test benchmark» không hỗ trợ loại nhận định này.'),
  ).toBeInTheDocument();
});
it('QH-07 links to the bank when no snapshot exists', async () => {
  const context = setup();
  await addQuestion();
  fireEvent.click(screen.getByRole('button', { name: 'Thêm giả thuyết' }));
  expect(screen.getByText(/Cần bản chụp Writing Bank để phân loại nhận định/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Writing Bank' })).toHaveAttribute(
    'href',
    `/p/${context.project.id}/bank`,
  );
});
it('QH-08 hides write controls for archived projects', async () => {
  setup({ readOnly: true });
  await screen.findByText('Chưa có câu hỏi nào.');
  expect(screen.getByText('Đã lưu trữ · chỉ đọc')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Thêm câu hỏi' })).not.toBeInTheDocument();
});
it('QH-09 shows loading and empty states', async () => {
  setup();
  expect(screen.getByText(/Đang tải/)).toBeInTheDocument();
  expect(await screen.findByText('Chưa có câu hỏi nào.')).toBeInTheDocument();
});
it('QH-10 shows load errors', async () => {
  setup({ fail: true });
  expect(await screen.findByText('Không tải được câu hỏi và giả thuyết.')).toBeInTheDocument();
});
it('QH-11 shows a hypothesis chain with links to measurement tabs', async () => {
  const draft = emptyDraft();
  draft.hypotheses.push({
    id: 'h-1',
    statement: 'Synthetic hypothesis',
    kind: 'exploratory',
    question: null,
    claim: null,
    independent: [],
    dependent: ['v-1'],
  });
  draft.variables.push({
    id: 'v-1',
    name: 'Synthetic variable',
    role: 'dependent',
    construct: '',
    metric: 'm-1',
    levels: [],
  });
  draft.metrics.push({
    id: 'm-1',
    name: 'Synthetic metric',
    key: 'test/score',
    unit: '',
    goal: null,
    aggregation: null,
    protocol: '',
    bank: null,
    protocolBank: null,
  });
  const context = setup({ draft });
  await screen.findByText('Synthetic hypothesis');
  expect(screen.getByRole('link', { name: 'v-1 Synthetic variable' })).toHaveAttribute(
    'href',
    `/p/${context.project.id}/measurement?tab=variables`,
  );
  expect(screen.getByRole('link', { name: 'm-1' })).toHaveAttribute(
    'href',
    `/p/${context.project.id}/measurement?tab=metrics`,
  );
});

it('QH-12 names unused objects in danger confirmations and shows chain warnings once', async () => {
  const draft = emptyDraft();
  draft.questions.push({ id: 'q-1', text: 'Invented question', gap: '', papers: [] });
  draft.hypotheses.push({
    id: 'h-1',
    statement: 'Invented statement',
    kind: 'directional',
    question: null,
    claim: null,
    independent: [],
    dependent: [],
  });
  setup({ draft });
  await screen.findByText('Invented statement');
  expect(screen.getAllByText('chưa có phân tích')).toHaveLength(1);
  expect(screen.getAllByText('chưa gắn biến phụ thuộc')).toHaveLength(1);
  for (const [index, id] of [
    [0, 'q-1'],
    [1, 'h-1'],
  ] as const) {
    fireEvent.click(screen.getAllByRole('button', { name: 'Xoá' })[index]!);
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(`Xoá ${id}?`)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Xoá' }).className).toMatch(/danger/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
  }
});
