import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { snapshot } from '@/core/bank/testSupport';
import { emptyDraft, type Draft } from '@/core/draft/schema';
import { ProjectContext } from '@/shared/project/projectContext';
import { setupClient } from '../corpus/testSupport';
import Page from './Page';
import { claimWord } from './words';

function setup({ draft = emptyDraft(), bank = true, readOnly = false, url = '/' } = {}) {
  const context = setupClient();
  context.docs.set(`${context.project.id}/draft`, { etag: 'draft', data: draft });
  if (bank)
    context.docs.set(`${context.project.id}/bank`, {
      etag: 'bank',
      data: {
        schemaVersion: 1,
        release: 'sha256:0123456789abcdef',
        source: 'test',
        importedBy: 'test',
        importedAt: '2026-01-01T00:00:00Z',
        collections: snapshot.collections,
      },
    });
  render(
    <context.wrapper>
      <ProjectContext.Provider value={{ project: context.project, readOnly }}>
        <MemoryRouter initialEntries={[url]}>
          <Page />
        </MemoryRouter>
      </ProjectContext.Provider>
    </context.wrapper>,
  );
  return context;
}
it('ME-01 shows tab counts and adds a variable', async () => {
  const context = setup();
  fireEvent.click(await screen.findByRole('tab', { name: 'Biến (0)' }));
  fireEvent.click(screen.getByRole('button', { name: 'Thêm biến' }));
  fireEvent.change(screen.getByLabelText('Tên'), { target: { value: 'Test variable' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  expect(await screen.findByText('Test variable')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Biến (1)' })).toHaveAttribute('aria-selected', 'true');
  expect((context.docs.get(`${context.project.id}/draft`)?.data as Draft).variables).toHaveLength(1);
});
it('ME-02 chooses a metric and follows a procedure without copying text', async () => {
  const context = setup();
  fireEvent.click(await screen.findByRole('tab', { name: /Metric/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Thêm metric' }));
  const entry = screen.getByText('Test score').parentElement!;
  fireEvent.click(within(entry).getByRole('button', { name: 'Dùng' }));
  expect(screen.getByLabelText('Tên')).toHaveValue('Test score');
  expect(screen.getByLabelText('Đơn vị')).toHaveValue('points');
  expect(screen.getByLabelText('Key MLflow')).toHaveValue('');
  expect(screen.getByLabelText('Cách gộp một lần chạy')).toHaveValue('');
  expect(screen.getByLabelText('Quy trình đo')).toHaveValue('');
  fireEvent.click(screen.getByLabelText('Theo quy trình này'));
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect((context.docs.get(`${context.project.id}/draft`)?.data as Draft).metrics[0]).toMatchObject({
    protocol: '',
    protocolBank: { id: 'mp.test-procedure' },
  });
  expect(screen.getByText(/còn thiếu:/)).toBeInTheDocument();
});
it('ME-03 handles missing snapshots and archived projects', async () => {
  setup({ bank: false, readOnly: true });
  fireEvent.click(await screen.findByRole('tab', { name: /Metric/ }));
  expect(screen.getByText('Đã lưu trữ · chỉ đọc')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Thêm metric' })).not.toBeInTheDocument();
});
it('ME-04 filters invented metrics and leaves descriptive direction unset', async () => {
  setup();
  fireEvent.click(await screen.findByRole('tab', { name: /Metric/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Thêm metric' }));
  fireEvent.click(screen.getByRole('button', { name: 'Phân loại (1)' }));
  expect(screen.queryByText('Test shape')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'invented alias' } });
  expect(screen.getByText('Test score')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tất cả (2)' }));
  fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'shape' } });
  expect(screen.queryByText('Test score')).not.toBeInTheDocument();
  fireEvent.click(
    within(screen.getByText('Test shape').parentElement!).getByRole('button', { name: 'Dùng' }),
  );
  expect(screen.getByLabelText('Hướng tốt')).toHaveValue('');
});
it('ME-05 saves a benchmark with its lifecycle and flaws', async () => {
  setup();
  fireEvent.click(await screen.findByRole('tab', { name: /Dataset/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Thêm dataset' }));
  fireEvent.click(
    within(screen.getByText('Test suite').parentElement!).getByRole('button', { name: 'Dùng' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  expect(await screen.findByText(/Bão hoà · An invented flaw/)).toBeInTheDocument();
});
it('ME-06 stores condition parameter types', async () => {
  const context = setup();
  fireEvent.click(await screen.findByRole('tab', { name: /Điều kiện/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Thêm điều kiện' }));
  fireEvent.change(screen.getByLabelText('Tên'), { target: { value: 'Test condition' } });
  for (const [key, value] of [
    ['count', '12'],
    ['enabled', 'true'],
    ['label', 'abc'],
  ]) {
    fireEvent.click(screen.getByRole('button', { name: 'Thêm tham số' }));
    const keys = screen.getAllByLabelText('Tên tham số');
    const values = screen.getAllByLabelText('Giá trị');
    fireEvent.change(keys[keys.length - 1]!, { target: { value: key } });
    fireEvent.change(values[values.length - 1]!, { target: { value } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect((context.docs.get(`${context.project.id}/draft`)?.data as Draft).conditions[0]?.params).toEqual({
    count: 12,
    enabled: true,
    label: 'abc',
  });
});
it('ME-07 offers a custom metric when the snapshot is absent', async () => {
  setup({ bank: false });
  fireEvent.click(await screen.findByRole('tab', { name: /Metric/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Thêm metric' }));
  expect(screen.getByRole('link', { name: 'Writing Bank' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Tự mô tả metric' })).toBeInTheDocument();
});
it('ME-08 attaches a dependent variable and refuses to delete its metric', async () => {
  const draft = emptyDraft();
  draft.hypotheses.push({
    id: 'h-1',
    statement: 'Test hypothesis',
    kind: 'directional',
    question: null,
    claim: null,
    independent: [],
    dependent: [],
  });
  draft.variables.push({
    id: 'v-1',
    name: 'Test variable',
    role: 'dependent',
    construct: '',
    metric: 'm-1',
    levels: [],
  });
  draft.metrics.push({
    id: 'm-1',
    name: 'Test metric',
    key: 'test/value',
    unit: 'points',
    goal: 'maximize',
    aggregation: 'last',
    protocol: 'Test protocol',
    bank: null,
    protocolBank: null,
  });
  setup({ draft });
  fireEvent.click(await screen.findByRole('button', { name: 'Gắn biến' }));
  fireEvent.click(screen.getByLabelText('v-1 Test variable'));
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByText('test/value')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: /Metric/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Xoá' }));
  expect(screen.getByText('m-1 đang được dùng bởi v-1. Gỡ liên kết trước khi xoá.')).toBeInTheDocument();
  expect(
    within(screen.getByRole('alertdialog')).queryByRole('button', { name: 'Xoá' }),
  ).not.toBeInTheDocument();
});
it('ME-09 reports loading and an error with a retry', async () => {
  const context = setupClient();
  vi.mocked(context.api.getDoc).mockRejectedValue(new Error('offline'));
  render(
    <context.wrapper>
      <MemoryRouter>
        <Page />
      </MemoryRouter>
    </context.wrapper>,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Đang tải');
  expect(await screen.findByText('Không tải được đo lường.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
});
it('ME-10 opens the tab named by the query', async () => {
  setup({ url: '/?tab=metrics' });
  expect(await screen.findByRole('tab', { name: 'Metric (0)', selected: true })).toBeInTheDocument();
  expect(screen.getByText('Chưa có metric nào.')).toBeInTheDocument();
});

function measurementDraft() {
  const draft = emptyDraft();
  draft.hypotheses.push({
    id: 'h-1',
    statement: 'Invented hypothesis',
    kind: 'directional',
    question: null,
    claim: null,
    independent: [],
    dependent: [],
  });
  draft.variables.push(
    {
      id: 'v-1',
      name: 'Invented factor',
      role: 'independent',
      construct: 'Invented concept',
      metric: null,
      levels: ['A', 'B'],
    },
    { id: 'v-2', name: 'Invented outcome', role: 'dependent', construct: '', metric: 'm-1', levels: [] },
    { id: 'v-3', name: 'Invented covariate', role: 'covariate', construct: '', metric: null, levels: [] },
  );
  draft.metrics.push({
    id: 'm-1',
    name: 'Invented measure',
    key: '',
    unit: '',
    goal: null,
    aggregation: null,
    protocol: '',
    bank: null,
    protocolBank: null,
  });
  draft.datasets.push({
    id: 'd-1',
    name: 'Invented data',
    source: '',
    version: null,
    split: null,
    sha256: null,
    benchmark: null,
  });
  draft.conditions.push({ id: 'c-1', name: 'Invented condition', baseline: false, params: {} });
  return draft;
}
it('ME-11 shows a missing chain link once', async () => {
  setup({ draft: measurementDraft() });
  expect(await screen.findByText('chưa gắn biến phụ thuộc')).toBeInTheDocument();
  expect(screen.queryByText('h-1 chưa gắn biến phụ thuộc.')).not.toBeInTheDocument();
});
it('ME-12 explains empty metric and dataset fields', async () => {
  setup({ draft: measurementDraft(), url: '/?tab=metrics' });
  expect((await screen.findByText('chưa có key')).parentElement).toHaveTextContent(
    'chưa có key · chưa có đơn vị · chưa chọn hướng tốt · chưa chọn cách gộp',
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Dataset (1)' }));
  expect(screen.getByText('Chưa ghi nguồn')).toBeInTheDocument();
});
it('ME-13 labels variable details and metric links', async () => {
  setup({ draft: measurementDraft(), url: '/?tab=variables' });
  expect(
    await screen.findByText('Độc lập · Khái niệm: Invented concept · Các mức: A, B'),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Metric: m-1 Invented measure' })).toHaveAttribute(
    'href',
    '/?tab=metrics',
  );
  expect(screen.getByText('Hiệp biến · chưa có metric')).toBeInTheDocument();
});
it('ME-14 describes the strongest supported claim', async () => {
  setup();
  fireEvent.click(await screen.findByRole('tab', { name: /Metric/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Thêm metric' }));
  expect(screen.getAllByText(/Nhận định mạnh nhất mà metric tự nó hỗ trợ:/).length).toBeGreaterThan(0);
  expect(['descriptive', 'comparative', 'inferential', 'invented'].map(claimWord)).toEqual([
    'mô tả',
    'so sánh',
    'suy luận thống kê',
    'invented',
  ]);
});
it('ME-15 names each deletion and describes the item', async () => {
  setup({ draft: measurementDraft(), url: '/?tab=datasets' });
  for (const [tab, title, description] of [
    ['Dataset (1)', 'Xoá dataset', 'Xoá d-1 «Invented data»?'],
    ['Điều kiện (1)', 'Xoá điều kiện', 'Xoá c-1 «Invented condition»?'],
    ['Biến (3)', 'Xoá biến', 'Xoá v-1 «Invented factor»?'],
  ]) {
    fireEvent.click(await screen.findByRole('tab', { name: tab }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Xoá' })[0]!);
    const dialog = screen.getByRole('alertdialog', { name: title, description });
    expect(within(dialog).getByRole('button', { name: 'Xoá' }).className).toMatch(/danger/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
  }
});
it('ME-16 renders each tab label as one text node', async () => {
  setup({ draft: measurementDraft() });
  const tab = await screen.findByRole('tab', { name: 'Biến (3)' });
  expect(tab.childNodes).toHaveLength(1);
  expect(tab.firstChild?.nodeType).toBe(Node.TEXT_NODE);
});
