import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { snapshot } from '@/core/bank/testSupport';
import { emptyDraft } from '@/core/draft/schema';
import { ApiError } from '@/shared/api/client';
import { useBank } from '@/shared/bank/useBank';
import { useDraft } from '@/shared/draft/useDraft';
import { addQuestion } from '@/core/draft/ops';
import { ProjectContext } from '@/shared/project/projectContext';
import { setupClient } from '../corpus/testSupport';
import Page from './Page';
import { contentHash } from '@/core/bank/release';

const config = vi.hoisted(() => ({ bankUrl: '' }));
vi.mock('@/shared/auth/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/auth/config')>()),
  get bankUrl() {
    return config.bankUrl;
  },
}));
afterEach(() => {
  config.bankUrl = '';
  vi.unstubAllGlobals();
});

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

it('D51 imports a verified bank release and displays its date and draft warning', async () => {
  const context = setupClient();
  const raw = {
    ...snapshot,
    release: '2031.02.1',
    date: '2031-02-01T00:00:00Z',
    notes: 'Test',
    includesDrafts: true,
    aliases: { 'rd.alpha': 'rd.beta' },
  };
  const cut = { ...raw, contentHash: await contentHash(raw) };
  const { container } = render(
    <context.wrapper>
      <Page />
    </context.wrapper>,
  );
  await screen.findByText('Chưa có bản chụp');
  fireEvent.change(container.querySelector('input[type=file]')!, {
    target: { files: [file(JSON.stringify(cut))] },
  });
  expect(await screen.findByText('2031.02.1')).toBeInTheDocument();
  expect(screen.getByText('Ngày phát hành: 2031-02-01T00:00:00Z')).toBeInTheDocument();
  expect(screen.getByText('Có mục bản nháp')).toBeInTheDocument();
  expect(screen.getByText(/Bản phát hành này gồm cả các mục Writing Bank chưa xuất bản/)).toBeInTheDocument();
  expect(context.api.putDoc).toHaveBeenCalledWith(
    context.project.id,
    'bank',
    expect.objectContaining({
      release: raw.release,
      releaseDate: raw.date,
      contentHash: cut.contentHash,
      includesDrafts: true,
      aliases: raw.aliases,
    }),
    null,
  );
});

it('D51 shows the hash refusal and does not write the snapshot', async () => {
  const context = setupClient();
  const { container } = render(
    <context.wrapper>
      <Page />
    </context.wrapper>,
  );
  await screen.findByText('Chưa có bản chụp');
  fireEvent.change(container.querySelector('input[type=file]')!, {
    target: {
      files: [file(JSON.stringify({ ...snapshot, release: '2031.02.1', contentHash: '0'.repeat(64) }))],
    },
  });
  expect(
    await screen.findByText(
      'Tệp không khớp mã băm nội dung mà nó tự khai; hãy tải lại bản phát hành từ Writing Bank.',
    ),
  ).toBeInTheDocument();
  expect(context.api.putDoc).not.toHaveBeenCalled();
});

it('D53 hides API actions when unconfigured and makes no bank calls on open', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const context = setupClient();
  render(
    <context.wrapper>
      <Page />
    </context.wrapper>,
  );
  await screen.findByText('Chưa có bản chụp');
  expect(screen.queryByRole('button', { name: 'Kiểm tra bản mới' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Lấy bản mới' })).not.toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
});

it('D31 checks a release only on request without storing it', async () => {
  config.bankUrl = 'https://bank.example/bank/v1';
  const response = { release: '2031.02.1', date: '2031-02-01T00:00:00Z', notes: '', includesDrafts: false };
  const fetcher = vi.fn(async () => new Response(JSON.stringify(response)));
  vi.stubGlobal('fetch', fetcher);
  const context = setupClient();
  vi.mocked(context.auth.getIdToken).mockResolvedValue('token');
  render(
    <context.wrapper>
      <Page />
    </context.wrapper>,
  );
  await screen.findByText('Chưa có bản chụp');
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra bản mới' }));
  await screen.findByText('Writing Bank có bản 2031.02.1, phát hành 2031-02-01T00:00:00Z.');
  expect(context.api.putDoc).not.toHaveBeenCalled();
});

it('D31 reports when the stored release is current', async () => {
  config.bankUrl = 'https://bank.example/bank/v1';
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            release: '2031.02.1',
            date: '2031-02-01T00:00:00Z',
            notes: '',
            includesDrafts: false,
          }),
        ),
    ),
  );
  const context = setupClient();
  vi.mocked(context.auth.getIdToken).mockResolvedValue('token');
  context.docs.set(`${context.project.id}/bank`, {
    etag: '1',
    data: {
      schemaVersion: 1,
      release: '2031.02.1',
      source: 'Synthetic',
      importedBy: 'test',
      importedAt: '2031-02-01T00:00:00Z',
      collections: snapshot.collections,
    },
  });
  render(
    <context.wrapper>
      <Page />
    </context.wrapper>,
  );
  await screen.findByText('2031.02.1');
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra bản mới' }));
  await screen.findByText('Dự án đang dùng bản mới nhất (2031.02.1).');
  expect(context.api.putDoc).not.toHaveBeenCalled();
});

it('D51 fetch validates a release, refuses missing release and hash mismatch, and handles conflict', async () => {
  const context = setupClient();
  const { result } = renderHook(() => useBank(), { wrapper: context.wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  const raw = { ...snapshot, release: '2031.02.1' };
  const valid = { ...raw, contentHash: await contentHash(raw) };
  await act(async () => {
    expect(await result.current.fetchSnapshot(async () => snapshot)).toMatchObject({ error: 'invalid' });
    expect(
      await result.current.fetchSnapshot(async () => ({ ...raw, contentHash: '0'.repeat(64) })),
    ).toMatchObject({ error: 'hash_mismatch' });
    expect(await result.current.fetchSnapshot(async () => ({ ...valid, formatVersion: 99 }))).toMatchObject({
      error: 'unsupported_version',
    });
  });
  expect(context.api.putDoc).not.toHaveBeenCalled();
  vi.mocked(context.api.putDoc).mockRejectedValueOnce(new ApiError(412, 'conflict', 'conflict'));
  await act(async () => {
    expect(await result.current.fetchSnapshot(async () => valid)).toMatchObject({ error: 'conflict' });
  });
  expect(context.api.getDoc).toHaveBeenCalledTimes(2);
  await act(async () => {
    expect(await result.current.fetchSnapshot(async () => valid)).toEqual({ ok: true });
  });
  expect(result.current.bank?.release).toBe('2031.02.1');
});

it('D31 confirms a fetched replacement when the draft references the current snapshot', async () => {
  config.bankUrl = 'https://bank.example/bank/v1';
  const raw = { ...snapshot, release: '2031.02.1' };
  const valid = { ...raw, contentHash: await contentHash(raw) };
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(valid))),
  );
  const context = setupClient();
  vi.mocked(context.auth.getIdToken).mockResolvedValue('token');
  context.docs.set(`${context.project.id}/bank`, {
    etag: '1',
    data: {
      schemaVersion: 1,
      release: 'sha256:0123456789abcdef',
      source: 'Synthetic',
      importedBy: 'test',
      importedAt: '2031-02-01T00:00:00Z',
      collections: snapshot.collections,
    },
  });
  context.docs.set(`${context.project.id}/draft`, {
    etag: '2',
    data: {
      ...emptyDraft(),
      design: {
        name: 'Test',
        assignment: null,
        bank: { id: 'rd.alpha-design', release: 'sha256:0123456789abcdef' },
      },
    },
  });
  render(
    <context.wrapper>
      <Page />
    </context.wrapper>,
  );
  await screen.findByRole('button', { name: 'Lấy bản mới' });
  fireEvent.click(screen.getByRole('button', { name: 'Lấy bản mới' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(context.api.putDoc).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Thay bản chụp' }));
  await waitFor(() =>
    expect(context.api.putDoc).toHaveBeenCalledWith(
      context.project.id,
      'bank',
      expect.objectContaining({ release: '2031.02.1' }),
      '1',
    ),
  );
});

it.each([
  [401, 'Writing Bank chưa chấp nhận tài khoản của ứng dụng này.'],
  [403, 'Writing Bank chưa chấp nhận tài khoản của ứng dụng này.'],
  [429, 'Writing Bank đang giới hạn số lần gọi; thử lại sau.'],
  [0, 'Không thể nhập bản chụp. Vui lòng thử lại.'],
])('D53 shows bank error %s for both actions', async (status, message) => {
  config.bankUrl = 'https://bank.example/bank/v1';
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (!status) throw new Error('offline');
      return new Response(JSON.stringify({ error: 'error', message: 'Error' }), { status });
    }),
  );
  const context = setupClient();
  vi.mocked(context.auth.getIdToken).mockResolvedValue('token');
  render(
    <context.wrapper>
      <Page />
    </context.wrapper>,
  );
  await screen.findByText('Chưa có bản chụp');
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra bản mới' }));
  await screen.findByText(message);
  fireEvent.click(screen.getByRole('button', { name: 'Lấy bản mới' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(message));
  expect(context.api.putDoc).not.toHaveBeenCalled();
});
