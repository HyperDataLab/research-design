import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import model from '../../../schemas/vendor/paper-model-v1.example.json';
import facts from '../../../schemas/vendor/experiment-facts-v1.example.json';
import { ApiError } from '@/shared/api/client';
import { setupClient } from './testSupport';
import { useCorpus } from './useCorpus';
import Page from './Page';
vi.mock('@/shared/auth/config', () => ({ paperlabUrl: 'https://paperlab', authMode: 'firebase' }));
const id = 'sha256-' + 'a'.repeat(64);
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ETag: '"tag"' } });
afterEach(() => vi.unstubAllGlobals());
it('imports models and replaces facts while preserving surviving decisions', async () => {
  const context = setupClient();
  vi.mocked(context.auth.getIdToken).mockResolvedValue('token');
  vi.mocked(context.api.listItems).mockResolvedValue([]);
  const fetcher = vi.fn(async (url: string) => response(url.endsWith('/model') ? model : facts));
  vi.stubGlobal('fetch', fetcher);
  const hook = renderHook(() => useCorpus(), { wrapper: context.wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(fetcher).not.toHaveBeenCalled();
  await act(async () => {
    expect(await hook.result.current.importPaperLab(id)).toMatchObject({ ok: true, created: true });
  });
  const paper = hook.result.current.doc.papers[0];
  if (!paper) throw Error();
  expect(paper.model?.paperlab).toEqual({ paperId: id, etag: '"tag"' });
  expect(hook.result.current.doc.log.map((entry) => entry.action)).toEqual(['added', 'model_imported']);
  await act(async () => {
    expect(await hook.result.current.importPaperLab(id)).toMatchObject({ ok: true, created: false });
  });
  await act(async () => {
    expect(await hook.result.current.fetchFacts(paper)).toMatchObject({ ok: true, dropped: 0 });
  });
  const key = context.project.id + '/facts/' + paper.id;
  const stored = context.items.get(key);
  if (!stored) throw Error();
  const doc = stored.data as { decisions: Record<string, unknown> };
  doc.decisions = { absent: { decision: 'use', reason: null, by: 'a', at: '2026-01-01T00:00:00Z' } };
  await act(async () => {
    expect(await hook.result.current.fetchFacts(paper)).toMatchObject({ ok: true, dropped: 1 });
  });
  expect(hook.result.current.factsIds).toContain(paper.id);
});
it('refuses invalid models, missing facts and Worker 413', async () => {
  const context = setupClient();
  vi.mocked(context.auth.getIdToken).mockResolvedValue('token');
  vi.mocked(context.api.listItems).mockResolvedValue([]);
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response({}))
    .mockResolvedValueOnce(response(model))
    .mockResolvedValueOnce(response(model))
    .mockResolvedValueOnce(response({ error: 'not_found', message: 'missing' }, 404));
  vi.stubGlobal('fetch', fetcher);
  const hook = renderHook(() => useCorpus(), { wrapper: context.wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  await act(async () => {
    expect(await hook.result.current.importPaperLab(id)).toMatchObject({
      ok: false,
      error: 'not_a_paper_model',
    });
  });
  vi.mocked(context.api.putItem).mockRejectedValueOnce(new ApiError(413, 'too_large', 'large'));
  await act(async () => {
    expect(await hook.result.current.importPaperLab(id)).toMatchObject({ ok: false, error: 'too_large' });
  });
  await act(async () => {
    await hook.result.current.importPaperLab(id);
  });
  const paper = hook.result.current.doc.papers[0];
  if (!paper) throw Error();
  await act(async () => {
    expect(await hook.result.current.fetchFacts(paper)).toMatchObject({ ok: false, error: 'not_found' });
  });
});

it('shows PaperLab list only after opening the dialog', async () => {
  const context = setupClient();
  vi.mocked(context.auth.getIdToken).mockResolvedValue('token');
  vi.mocked(context.api.listItems).mockResolvedValue([]);
  const fetcher = vi.fn(async () =>
    response({
      items: [
        {
          paperId: id,
          title: 'Published paper',
          doi: '10.1234/example',
          sourceSha256: null,
          updatedAt: '2026-01-01T00:00:00Z',
          publishedBy: 'a@lab',
          experimentFacts: 'reviewed',
        },
      ],
      nextCursor: null,
    }),
  );
  vi.stubGlobal('fetch', fetcher);
  render(
    <context.wrapper>
      <Page />
    </context.wrapper>,
  );
  await screen.findByText('Ch\u01b0a c\u00f3 b\u00e0i b\u00e1o n\u00e0o');
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Th\u00eam t\u1eeb PaperLab' }));
  expect(await screen.findByText('Published paper')).toBeInTheDocument();
  expect(screen.getByText(/a@lab/)).toHaveTextContent('D\u1eef ki\u1ec7n \u0111\u00e3 duy\u1ec7t');
  expect(screen.getByText('10.1234/example')).toBeInTheDocument();
});
it('says that PaperLab does not accept this app yet when the list answers 403', async () => {
  const context = setupClient();
  vi.mocked(context.auth.getIdToken).mockResolvedValue('token');
  vi.mocked(context.api.listItems).mockResolvedValue([]);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response({ error: 'forbidden', message: 'x' }, 403)),
  );
  render(<Page />, { wrapper: context.wrapper });
  fireEvent.click(await screen.findByRole('button', { name: 'Thêm từ PaperLab' }));
  expect(await screen.findByText('PaperLab chưa chấp nhận tài khoản của ứng dụng này.')).toBeTruthy();
});
