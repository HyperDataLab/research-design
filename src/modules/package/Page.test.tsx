import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { emptyDraft, type Draft } from '@/core/draft/schema';
import { checkPackage } from '@/core/plan/exportPackage';
import type { ExperimentPlan } from '@/core/plan/schema';
import { ApiError } from '@/shared/api/client';
import * as downloads from '@/shared/plan/download';
import { ProjectContext } from '@/shared/project/projectContext';
import { ToastProvider } from '@/shared/ui/ToastProvider';
import { setupClient } from '../corpus/testSupport';
import Page from './Page';

function complete() {
  const d = emptyDraft();
  d.questions = [{ id: 'q-1', text: 'Question', gap: 'Gap', papers: [] }];
  d.hypotheses = [
    {
      id: 'h-1',
      statement: 'Hypothesis',
      kind: 'exploratory',
      question: 'q-1',
      claim: null,
      independent: [],
      dependent: ['v-1'],
    },
  ];
  d.variables = [
    { id: 'v-1', name: 'Variable', role: 'dependent', construct: 'Construct', metric: 'm-1', levels: [] },
  ];
  d.metrics = [
    {
      id: 'm-1',
      name: 'Metric',
      key: 'score',
      unit: 'points',
      goal: 'maximize',
      aggregation: 'mean',
      protocol: 'Measure',
      bank: null,
      protocolBank: null,
    },
  ];
  d.datasets = [
    {
      id: 'd-1',
      name: 'Dataset',
      source: 'Source',
      version: null,
      split: null,
      sha256: null,
      benchmark: null,
    },
  ];
  d.conditions = [{ id: 'c-1', name: 'Condition', baseline: true, params: {} }];
  d.runMatrix = {
    mlflowExperiment: 'Experiment',
    conditions: ['c-1'],
    datasets: ['d-1'],
    seeds: [1],
    sampleSizeJustification: 'Prior work',
  };
  return d;
}
function setup(draft: Draft = complete(), readOnly = false) {
  const context = setupClient();
  const stored: ExperimentPlan[] = [];
  context.docs.set(`${context.project.id}/draft`, { etag: 'draft', data: draft });
  context.api.listPlans = vi.fn(async () =>
    stored.map((p) => ({ version: p.planVersion, frozenAt: p.frozenAt, frozenBy: p.frozenBy })),
  );
  context.api.getPlan = vi.fn(async (_id, v) => stored.find((p) => p.planVersion === v)!);
  context.api.freezePlan = vi.fn(async (_id, p) => {
    stored.push(p);
    return p;
  });
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
  return { ...context, stored };
}
it('PK-01 shows missing items as links', async () => {
  setup(emptyDraft());
  expect(await screen.findByRole('link', { name: 'Chưa có giả thuyết.' })).toHaveAttribute(
    'href',
    expect.stringContaining('/questions'),
  );
  expect(screen.getByRole('button', { name: 'Đóng băng phiên bản 1' })).toBeDisabled();
});
it('PK-02 displays ten passing rules and freezes version one', async () => {
  const context = setup();
  const button = await screen.findByRole('button', { name: 'Đóng băng phiên bản 1' });
  expect(button).toBeEnabled();
  expect(screen.getAllByText(/PP-\d\d:/)).toHaveLength(10);
  fireEvent.click(button);
  fireEvent.click(screen.getByRole('button', { name: 'Đóng băng' }));
  expect(await screen.findByText(/Phiên bản 1 · a@hyperdatalab.org/)).toBeInTheDocument();
  expect(context.stored[0]?.deviation).toBeNull();
  expect(await screen.findByText('Bản nháp không khác phiên bản 1.')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Xem' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Xem' }));
  expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Hypotheses' })).toBeInTheDocument();
});
it('PK-03 names a blocking issue', async () => {
  const draft = complete();
  draft.hypotheses[0]!.kind = 'directional';
  setup(draft);
  expect(await screen.findByText('Chặn')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /h-1 chưa có phân tích/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Đóng băng phiên bản 1' })).toBeDisabled();
});
it('PK-04 displays flags, archived and empty states', async () => {
  setup(emptyDraft(), true);
  expect(await screen.findByText('Chưa có phiên bản nào được đóng băng.')).toBeInTheDocument();
  expect(screen.getByText('Đã lưu trữ · chỉ đọc')).toBeInTheDocument();
  expect(screen.queryByLabelText('Tên kế hoạch')).not.toBeInTheDocument();
});

it('PK-06 requires a deviation on the next changed version', async () => {
  const context = setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Đóng băng phiên bản 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Đóng băng' }));
  await screen.findByText('Đã đóng băng phiên bản 1.');
  fireEvent.change(screen.getByLabelText('Tên kế hoạch'), { target: { value: 'Changed title' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu tên' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Đóng băng phiên bản 2' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Đóng băng phiên bản 2' }));
  expect(screen.getByRole('button', { name: 'Đóng băng' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Thay đổi so với phiên bản trước và lý do'), {
    target: { value: 'New title' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Đóng băng' }));
  await waitFor(() => expect(context.stored[1]?.deviation).toBe('New title'));
});

it('PK-07 shows a conflict in the dialog', async () => {
  const context = setup();
  vi.mocked(context.api.freezePlan!).mockRejectedValue(new ApiError(409, 'conflict', 'conflict'));
  fireEvent.click(await screen.findByRole('button', { name: 'Đóng băng phiên bản 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Đóng băng' }));
  expect(
    await screen.findByText('Người khác vừa đóng băng phiên bản này. Danh sách đã được tải lại.'),
  ).toBeInTheDocument();
});

it('PK-08 exports the frozen package and copies runner files', async () => {
  const save = vi.spyOn(downloads, 'download').mockImplementation(() => {});
  const copy = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } });
  setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Đóng băng phiên bản 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Đóng băng' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Tải gói (.zip)' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Tải gói (.zip)' }));
  await waitFor(() => expect(save).toHaveBeenCalled());
  expect((await checkPackage(save.mock.calls[0]![1])).ok).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Mã mẫu cho runner' }));
  expect(screen.getAllByRole('button', { name: 'Sao chép' })).toHaveLength(3);
  fireEvent.click(screen.getAllByRole('button', { name: 'Sao chép' })[0]!);
  expect(await screen.findByText('Đã sao chép.')).toBeInTheDocument();
  expect(copy).toHaveBeenCalledOnce();
  save.mockRestore();
});

it('PK-09 permits a P1 warning and shows it in the dialog', async () => {
  const draft = complete();
  draft.analyses = [
    {
      id: 'a-1',
      hypothesis: null,
      method: 'anova_oneway',
      variables: ['v-1'],
      conditions: [],
      parameters: {},
      assumptions: [],
      missingPolicy: 'listwise',
      alpha: 0.05,
      correction: 'none',
    },
  ];
  setup(draft);
  expect(await screen.findByText('Cảnh báo')).toBeInTheDocument();
  const button = screen.getByRole('button', { name: 'Đóng băng phiên bản 1' });
  expect(button).toBeEnabled();
  fireEvent.click(button);
  expect(within(screen.getByRole('alertdialog')).getByText(/a-1 dùng phương pháp/)).toBeInTheDocument();
});

it('PK-10 counts flags and links to their screens', async () => {
  const draft = complete();
  draft.hypotheses[0]!.claim = 'ct.invented';
  draft.metrics[0]!.unit = '';
  setup(draft);
  expect(await screen.findByRole('link', { name: 'Thiết kế nghiên cứu: 1' })).toHaveAttribute(
    'href',
    expect.stringContaining('/design'),
  );
  expect(screen.getByRole('link', { name: 'Câu hỏi và giả thuyết: 1' })).toHaveAttribute(
    'href',
    expect.stringContaining('/questions'),
  );
  expect(screen.getByRole('link', { name: 'Đo lường: 1' })).toHaveAttribute(
    'href',
    expect.stringContaining('/measurement'),
  );
});
