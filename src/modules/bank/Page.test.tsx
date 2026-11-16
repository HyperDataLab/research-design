import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { snapshot } from '@/core/bank/testSupport';
import { emptyDraft } from '@/core/draft/schema';
import { ApiError } from '@/shared/api/client';
import { useBank } from '@/shared/bank/useBank';
import { useDraft } from '@/shared/draft/useDraft';
import { addQuestion } from '@/core/draft/ops';
import { ProjectContext } from '@/shared/project/projectContext';
import { setupClient } from '../corpus/testSupport';
import Page from './Page';

function file(text: string, size?: number) {
  const f = new File([text], 'test.json');
  Object.defineProperty(f, 'arrayBuffer', { value: async () => new TextEncoder().encode(text).buffer });
  if (size !== undefined) Object.defineProperty(f, 'size', { value: size });
  return f;
}
it('BK-04 imports bytes with a content hash and refuses invalid files', async () => {
  const context = setupClient();
  const { result } = renderHook(() => useBank(), { wrapper: context.wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    expect(await result.current.importSnapshot(file('x', 2 * 1024 * 1024 + 1))).toMatchObject({
      error: 'too_large',
    });
  });
  await act(async () => {
    expect(await result.current.importSnapshot(file('{'))).toMatchObject({ error: 'not_json' });
  });
  const text = JSON.stringify(snapshot);
  await act(async () => {
    expect(await result.current.importSnapshot(file(text))).toEqual({ ok: true });
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hash = Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
  expect(result.current.bank?.release).toBe('sha256:' + hash);
  expect(context.api.putDoc).toHaveBeenCalledWith(
    context.project.id,
    'bank',
    expect.objectContaining({ release: 'sha256:' + hash }),
    null,
  );
});
it('BK-05 reloads on conflict', async () => {
  const context = setupClient();
  const { result } = renderHook(() => useBank(), { wrapper: context.wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  vi.mocked(context.api.putDoc).mockRejectedValueOnce(new ApiError(412, 'conflict', 'conflict'));
  await act(async () => {
    expect(await result.current.importSnapshot(file(JSON.stringify(snapshot)))).toMatchObject({
      error: 'conflict',
    });
  });
  expect(context.api.getDoc).toHaveBeenCalledTimes(2);
});
it('BK-06 shows empty state and refused file', async () => {
  const context = setupClient();
  const { container } = render(
    <context.wrapper>
      <Page />
    </context.wrapper>,
  );
  await screen.findByText('Chưa có bản chụp');
  fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [file('{')] } });
  expect(await screen.findByText('Tệp không phải JSON.')).toBeInTheDocument();
});
it('BK-07 read-only hides writes', async () => {
  const context = setupClient();
  render(
    <context.wrapper>
      <ProjectContext.Provider value={{ project: context.project, readOnly: true }}>
        <Page />
      </ProjectContext.Provider>
    </context.wrapper>,
  );
  await screen.findByText('Chưa có bản chụp');
  expect(screen.getByText('Đã lưu trữ · chỉ đọc')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Nhập bản chụp' })).not.toBeInTheDocument();
});
it('BK-08 confirms replacement when referenced', async () => {
  const context = setupClient();
  const collections = snapshot.collections;
  context.docs.set(`${context.project.id}/bank`, {
    etag: '1',
    data: {
      schemaVersion: 1,
      release: 'sha256:0123456789abcdef',
      source: 'Synthetic source',
      importedBy: 'test',
      importedAt: '2026-01-01T00:00:00Z',
      collections,
    },
  });
  context.docs.set(`${context.project.id}/draft`, {
    etag: '2',
    data: {
      ...emptyDraft(),
      design: {
        name: 'Test',
        assignment: null,
        bank: { id: 'rd.test-benchmark', release: 'sha256:0123456789abcdef' },
      },
    },
  });
  const { container } = render(
    <context.wrapper>
      <Page />
    </context.wrapper>,
  );
  await screen.findByRole('button', { name: 'Thay bản chụp' });
  expect(
    screen.getByText(new RegExp(new Date('2026-01-01T00:00:00Z').toLocaleString('vi-VN'))),
  ).toBeInTheDocument();
  fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [file('{')] } });
  await screen.findByText('Tệp không phải JSON.');
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  fireEvent.change(container.querySelector('input[type=file]')!, {
    target: { files: [file(JSON.stringify(snapshot))] },
  });
  const dialog = await screen.findByRole('alertdialog');
  expect(dialog).toHaveTextContent('Bản nháp đang tham chiếu bản chụp hiện tại. Thay bản chụp?');
  expect(context.api.putDoc).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
  expect(context.api.putDoc).not.toHaveBeenCalled();
  fireEvent.change(container.querySelector('input[type=file]')!, {
    target: { files: [file(JSON.stringify(snapshot))] },
  });
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Thay bản chụp' }),
  );
  await waitFor(() => expect(context.api.putDoc).toHaveBeenCalledTimes(1));
});

it('DR-05 writes draft changes and reports network errors', async () => {
  const context = setupClient();
  const { result } = renderHook(() => useDraft(), { wrapper: context.wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    expect(
      await result.current.change((d) => addQuestion(d, { text: 'Question', gap: '', papers: [] })),
    ).toMatchObject({ ok: true });
  });
  expect(result.current.draft.questions[0]?.id).toBe('q-1');
  vi.mocked(context.api.getDoc).mockRejectedValueOnce(new Error('offline'));
  await act(async () => {
    expect(
      await result.current.change((d) => addQuestion(d, { text: 'Another', gap: '', papers: [] })),
    ).toMatchObject({ error: 'network' });
  });
});

it('BK-09 asks before replacement when draft cannot be loaded', async () => {
  const context = setupClient();
  context.docs.set(`${context.project.id}/bank`, {
    etag: '1',
    data: {
      schemaVersion: 1,
      release: 'sha256:0123456789abcdef',
      source: 'Synthetic',
      importedBy: 'test',
      importedAt: '2026-01-01T00:00:00Z',
      collections: snapshot.collections,
    },
  });
  context.docs.set(`${context.project.id}/draft`, { etag: '2', data: { invalid: true } });
  const { container } = render(
    <context.wrapper>
      <Page />
    </context.wrapper>,
  );
  await screen.findByRole('button', { name: 'Thay bản chụp' });
  fireEvent.change(container.querySelector('input[type=file]')!, {
    target: { files: [file(JSON.stringify(snapshot))] },
  });
  expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  expect(context.api.putDoc).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Hủy' }));
});
