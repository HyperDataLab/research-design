import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { addPaper, emptyPapersDoc } from '@/core/papers/papers';
import { ProjectContext } from '@/shared/project/projectContext';
import Page from './Page';
import { file, setupClient } from './testSupport';
const input = {
  title: 'Synthetic paper',
  authors: ['Author'],
  year: 2020,
  venue: 'Journal',
  doi: '10.1234/example',
};
function setup(readOnly = false) {
  const context = setupClient();
  const added = addPaper(
    emptyPapersDoc(),
    input,
    'a@hyperdatalab.org',
    '2026-01-01T00:00:00Z',
    'p-000000000001',
  );
  if (!added.ok) throw Error();
  context.docs.set(`${context.project.id}/papers`, { data: added.doc, etag: 'initial' });
  render(
    <context.wrapper>
      <ProjectContext.Provider value={{ project: context.project, readOnly }}>
        <Page />
      </ProjectContext.Provider>
    </context.wrapper>,
  );
  return context;
}
describe('corpus page', () => {
  it('CO-10 lists papers and filters with counts', async () => {
    setup();
    expect(await screen.findByText('Synthetic paper')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /PaperLab/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Đã chọn/ }));
    expect(screen.queryByText('Synthetic paper')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Chưa quyết định/ }));
    expect(screen.getByText('Synthetic paper')).toBeInTheDocument();
  });
  it('CO-11 duplicate DOI stays in dialog', async () => {
    setup();
    await screen.findByText('Synthetic paper');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm bài báo' }));
    fireEvent.change(screen.getByLabelText('DOI'), { target: { value: input.doi } });
    fireEvent.change(screen.getByLabelText('Tên bài'), { target: { value: 'Another' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Bài báo có DOI này đã có trong dự án.')).toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
  it('CO-12 exclusion requires reason and logs it', async () => {
    setup();
    await screen.findByText('Synthetic paper');
    fireEvent.click(screen.getByRole('button', { name: 'Loại' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Loại' }));
    expect(await screen.findByText('Vui lòng nhập lý do.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Outside scope' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Loại' }));
    expect(await screen.findByText('Lý do: Outside scope')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Nhật ký/ }));
    expect(screen.getByText(/đã loại «Synthetic paper»: Outside scope/)).toBeInTheDocument();
  });
  it('CO-13 refused import is dismissible', async () => {
    const context = setupClient();
    const { container } = render(
      <context.wrapper>
        <Page />
      </context.wrapper>,
    );
    await screen.findByText('Chưa có bài báo nào');
    const inputElement = container.querySelector('input[type=file]');
    if (!inputElement) throw Error();
    fireEvent.change(inputElement, { target: { files: [file('{')] } });
    expect(await screen.findByText('Tệp không phải JSON.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByText('Tệp không phải JSON.')).not.toBeInTheDocument();
  });
  it('CO-14 archived project has no writing controls', async () => {
    const context = setup(true);
    await screen.findByText('Synthetic paper');
    expect(screen.getByText('Đã lưu trữ · chỉ đọc')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thêm bài báo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Loại' })).not.toBeInTheDocument();
    expect(context.api.putDoc).not.toHaveBeenCalled();
  });
  it('CO-15 load error can retry', async () => {
    const context = setupClient();
    vi.mocked(context.api.getDoc).mockRejectedValueOnce(new Error('offline'));
    render(
      <context.wrapper>
        <Page />
      </context.wrapper>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(screen.getByText('Chưa có bài báo nào')).toBeInTheDocument());
  });
});
