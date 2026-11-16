import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { snapshot } from '@/core/bank/testSupport';
import { emptyDraft, type Draft } from '@/core/draft/schema';
import { ProjectContext } from '@/shared/project/projectContext';
import { setupClient } from '../corpus/testSupport';
import Page from './Page';
import styles from './Page.module.css';

const release = 'sha256:0123456789abcdef';
function setup(options: { bank?: boolean; draft?: Draft; readOnly?: boolean; draftThreat?: boolean } = {}) {
  const context = setupClient();
  if (options.bank !== false)
    context.docs.set(`${context.project.id}/bank`, {
      etag: 'bank',
      data: {
        schemaVersion: 1,
        release,
        source: 'synthetic',
        importedBy: 'test',
        importedAt: '2026-01-01T00:00:00Z',
        collections: {
          ...snapshot.collections,
          threats: snapshot.collections.threats.map((t) =>
            options.draftThreat ? { ...t, status: 'draft' } : t,
          ),
          designs: snapshot.collections.designs.map((d) => ({ ...d, cannotSupport: ['Invented limit.'] })),
        },
      },
    });
  if (options.draft) context.docs.set(`${context.project.id}/draft`, { etag: 'draft', data: options.draft });
  render(
    <context.wrapper>
      <ProjectContext.Provider value={{ project: context.project, readOnly: !!options.readOnly }}>
        <MemoryRouter>
          <Page />
        </MemoryRouter>
      </ProjectContext.Provider>
    </context.wrapper>,
  );
  return context;
}
async function choose(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: 'Chọn thiết kế' }));
  const entry = screen.getByText(name).parentElement!;
  fireEvent.click(within(entry).getByRole('button', { name: 'Chọn' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}
it('RD-01 selects a bank design and shows supported claims and unchanged limits', async () => {
  setup();
  await choose('Test experiment');
  expect(screen.getByText('Causal')).toBeInTheDocument();
  expect(screen.getByText('Invented limit.')).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Ngẫu nhiên' })).toBeDisabled();
});
it('RD-02 requires assignment for an either design until selected', async () => {
  setup();
  await choose('Test benchmark');
  expect(screen.getByText(/chưa có cách phân nhóm/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: 'Không ngẫu nhiên' }));
  await waitFor(() => expect(screen.queryByText(/chưa có cách phân nhóm/)).not.toBeInTheDocument());
});
it('RD-03 links unsupported hypotheses to questions', async () => {
  const draft = emptyDraft();
  draft.hypotheses.push({
    id: 'h-1',
    statement: 'Test',
    kind: 'directional',
    question: null,
    claim: 'ct.descriptive',
    independent: [],
    dependent: [],
  });
  setup({ draft });
  await choose('Test experiment');
  expect(screen.getByRole('link', { name: 'h-1' })).toHaveAttribute('href', '/p/0123456789abcdef/questions');
  expect(screen.getByText(/không hỗ trợ loại nhận định này/)).toBeInTheDocument();
});
it('RD-04 adds offered threats with an empty mitigation and excludes registered threats', async () => {
  const context = setup();
  await choose('Test experiment');
  fireEvent.click(screen.getByRole('button', { name: 'Thêm vào danh sách' }));
  await screen.findByText('Chưa ghi cách giảm');
  expect(screen.queryByRole('button', { name: 'Thêm vào danh sách' })).not.toBeInTheDocument();
  expect(screen.queryByText('Gợi ý từ thiết kế')).not.toBeInTheDocument();
  expect(screen.getByText('Đã thêm mọi mối đe doạ mà thiết kế này gợi ý.')).toBeInTheDocument();
  expect((context.docs.get(`${context.project.id}/draft`)?.data as Draft).threats[0]).toMatchObject({
    mitigation: '',
    bank: { id: 'vt.test-confound', release },
  });
});
it('RD-05 self-described design works without a snapshot', async () => {
  setup({ bank: false });
  fireEvent.click(await screen.findByRole('button', { name: 'Chọn thiết kế' }));
  expect(screen.getByRole('link', { name: 'Writing Bank' })).toHaveAttribute(
    'href',
    '/p/0123456789abcdef/bank',
  );
  fireEvent.change(screen.getByLabelText('Tên thiết kế'), { target: { value: 'Custom study' } });
  fireEvent.click(screen.getByRole('button', { name: 'Chọn thiết kế tự mô tả' }));
  expect(await screen.findByText(/Thiết kế tự mô tả không có thông tin/)).toBeInTheDocument();
  expect(screen.queryByText('Gợi ý từ thiết kế')).not.toBeInTheDocument();
});
it('RD-06 shows missing snapshot references after replacement', async () => {
  const draft = emptyDraft();
  draft.design = { name: 'Old design', assignment: 'random', bank: { id: 'rd.missing', release } };
  setup({ draft });
  expect(await screen.findByText(/không còn trong bản chụp hiện tại/)).toBeInTheDocument();
});
it('RD-07 archived projects have no write controls', async () => {
  const draft = emptyDraft();
  draft.design = { name: 'Custom', assignment: 'none', bank: null };
  setup({ draft, readOnly: true });
  await screen.findByText('Custom');
  expect(screen.getByText('Đã lưu trữ · chỉ đọc')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Đổi thiết kế|Thêm mối đe doạ/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
});
it('RD-08 loading, empty and error states', async () => {
  const context = setupClient();
  vi.mocked(context.api.getDoc).mockRejectedValue(new Error('offline'));
  render(
    <context.wrapper>
      <Page />
    </context.wrapper>,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Đang tải');
  expect(await screen.findByText('Không tải được thiết kế.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
});

it('RD-09 repins old references once and preserves missing references', async () => {
  const draft = emptyDraft();
  draft.design = {
    name: 'Test benchmark',
    assignment: null,
    bank: { id: 'rd.test-benchmark', release: 'old' },
  };
  draft.threats = [
    { id: 't-1', name: 'Test', mitigation: '', bank: { id: 'vt.test-confound', release: 'old' } },
    { id: 't-2', name: 'Missing', mitigation: '', bank: { id: 'vt.missing', release: 'old' } },
  ];
  const context = setup({ draft });
  expect(
    await screen.findByText('Một số tham chiếu thuộc bản chụp cũ nhưng vẫn có trong bản chụp hiện tại.'),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Ghim lại theo bản chụp hiện tại' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Ghim lại theo bản chụp hiện tại' })).not.toBeInTheDocument(),
  );
  const saved = context.docs.get(`${context.project.id}/draft`)?.data as Draft;
  expect(saved.design?.bank?.release).toBe(release);
  expect(saved.threats[1]?.bank?.release).toBe('old');
});

it('RD-11 read-only old references show one notice without a repin control', async () => {
  const draft = emptyDraft();
  draft.design = {
    name: 'Test benchmark',
    assignment: null,
    bank: { id: 'rd.test-benchmark', release: 'old' },
  };
  setup({ draft, readOnly: true });
  expect(
    await screen.findByText('Một số tham chiếu thuộc bản chụp cũ nhưng vẫn có trong bản chụp hiện tại.'),
  ).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Ghim lại theo bản chụp hiện tại' })).not.toBeInTheDocument();
});

it('RD-12 separates a draft bank badge from its threat name with a token gap', async () => {
  const draft = emptyDraft();
  draft.threats = [
    { id: 't-1', name: 'Test confound', mitigation: '', bank: { id: 'vt.test-confound', release } },
  ];
  setup({ draft, draftThreat: true });
  const name = await screen.findByText('Test confound');
  const heading = name.parentElement!;
  expect(heading).toHaveClass(styles.threatHeading!);
  expect(within(heading).getByText('Bản nháp của bank')).toBeInTheDocument();
  expect(readFileSync('src/modules/design/Page.module.css', 'utf8')).toMatch(
    /\.threatHeading\s*\{[^}]*gap:\s*var\(--space-2\)/s,
  );
});
