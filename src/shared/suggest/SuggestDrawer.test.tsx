/* eslint-disable no-restricted-imports -- Integration tests exercise all three module entry points. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { addPaper, decide, emptyPapersDoc } from '@/core/papers/papers';
import { ApiError } from '@/shared/api/client';
import { setupClient } from '@/modules/corpus/testSupport';
import { ProjectContext } from '@/shared/project/projectContext';
import Questions from '@/modules/questions/Page';
import Measurement from '@/modules/measurement/Page';
import Design from '@/modules/design/Page';

const paperId = 'p-012345abcdef';
const ref = paperId + '/fact-1';
const response = (content: string) => ({
  content,
  finishReason: 'stop',
  model: 'invented',
  usage: { inputTokens: 1, outputTokens: 1, estimated: false },
});
function setup(Page = Questions, options: { used?: boolean; readOnly?: boolean; consent?: boolean } = {}) {
  const context = setupClient();
  const added = addPaper(
    emptyPapersDoc(),
    { title: 'Invented paper', authors: [], year: null, venue: null, doi: null },
    'person',
    '2026-01-01T00:00:00Z',
    paperId,
  );
  if (!added.ok) throw Error();
  const included = decide(added.doc, paperId, 'included', null, 'person', '2026-01-01T00:00:00Z');
  if (!included.ok) throw Error();
  context.docs.set(context.project.id + '/papers', { data: included.doc, etag: '1' });
  context.items.set(context.project.id + '/facts/' + paperId, {
    etag: '1',
    data: {
      schemaVersion: 1,
      paperId,
      source: { paperlabId: 'x', etag: 'e', fetchedBy: 'person', fetchedAt: '2026-01-01T00:00:00Z' },
      facts: {
        format: 'paperlab-experiment-facts',
        schemaVersion: 1,
        paperId: '00000000-0000-4000-8000-000000000001',
        modelEtag: 'a'.repeat(64),
        generatedAt: '2026-01-01T00:00:00.000Z',
        run: {
          id: '00000000-0000-4000-8000-0000000000aa',
          promptVersion: 'v1',
          model: 'test',
          at: '2026-01-01T00:00:00.000Z',
        },
        facts: [
          {
            id: 'fact-1',
            kind: 'metric',
            value: 'Invented accuracy',
            number: null,
            unit: null,
            uncertainty: null,
            condition: null,
            metric: null,
            dataset: null,
            system: null,
            sentenceKeys: ['f070f37a466398fb#1'],
            tableCell: { blockId: 't1', row: 1, column: 1, rowHeader: 'SECRET HEADER', columnHeader: null },
            status: 'candidate',
          },
        ],
      },
      decisions: options.used
        ? { 'fact-1': { decision: 'use', reason: null, by: 'person', at: '2026-01-01T00:00:00Z' } }
        : {},
    },
  });
  vi.mocked(context.api.getConsent).mockResolvedValue({
    required: { version: 1, provider: 'test' },
    configured: true,
    accepted:
      options.consent === false
        ? null
        : { version: 1, provider: 'test', acceptedBy: 'person', acceptedAt: '2026-01-01T00:00:00Z' },
  });
  vi.mocked(context.api.chat).mockResolvedValue(
    response(
      JSON.stringify({
        suggestions: [{ text: 'Measure invented accuracy', cites: [ref, 'p-ffffffffffff/unknown'] }],
      }),
    ),
  );
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
async function open() {
  fireEvent.click(await screen.findByRole('button', { name: 'Gợi ý từ bảng so sánh' }));
}
async function send() {
  fireEvent.click(await screen.findByRole('button', { name: 'Gửi và nhận gợi ý' }));
}
it('FR-405 does not send without a use decision', async () => {
  const ctx = setup();
  await open();
  expect(await screen.findByText('Chưa có dữ kiện nào được đặt Dùng.')).toBeInTheDocument();
  expect(screen.queryByText('Gửi và nhận gợi ý')).not.toBeInTheDocument();
  expect(ctx.api.chat).not.toHaveBeenCalled();
});
it('FR-405 sends one minimal request and removes unknown citations', async () => {
  const ctx = setup(Questions, { used: true });
  await open();
  expect(await screen.findByText(/Sẽ gửi 1 dữ kiện/)).toBeInTheDocument();
  await send();
  expect(await screen.findByText('Đã bỏ 1 trích dẫn không thuộc dữ kiện đã gửi.')).toBeInTheDocument();
  expect(screen.getByText('Invented accuracy · Invented paper')).toBeInTheDocument();
  expect(screen.queryByText(/unknown/)).not.toBeInTheDocument();
  expect(ctx.api.chat).toHaveBeenCalledTimes(1);
  const body = JSON.stringify(vi.mocked(ctx.api.chat).mock.calls[0]);
  expect(body).not.toContain('f070f37a466398fb#1');
  expect(body).not.toContain('SECRET HEADER');
});
it('FR-405 reports unreadable answers', async () => {
  const ctx = setup(Questions, { used: true });
  vi.mocked(ctx.api.chat).mockResolvedValue(response('bad'));
  await open();
  await send();
  expect(await screen.findByText('AI trả lời không đúng định dạng; hãy thử lại.')).toBeInTheDocument();
});
it('FR-405 shows consent gate and does not call AI', async () => {
  const ctx = setup(Questions, { used: true, consent: false });
  await open();
  expect(await screen.findByText(/Cần đồng ý gửi dữ liệu cho AI/)).toBeInTheDocument();
  expect(ctx.api.chat).not.toHaveBeenCalled();
});
it('FR-405 maps a consent refusal from the server', async () => {
  const ctx = setup(Questions, { used: true });
  vi.mocked(ctx.api.chat).mockRejectedValue(new ApiError(403, 'consent_required', ''));
  await open();
  await send();
  expect(await screen.findByText(/Cần đồng ý gửi dữ liệu cho AI/)).toBeInTheDocument();
});
for (const [name, Page, field] of [
  ['hypotheses', Questions, 'hypotheses'],
  ['metrics', Measurement, 'metrics'],
  ['threats', Design, 'threats'],
] as const) {
  it('FR-405 adds ' + name + ' through the draft operation', async () => {
    const ctx = setup(Page, { used: true });
    await open();
    await send();
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm vào bản nháp' }));
    expect(await screen.findByText('Đã thêm')).toBeInTheDocument();
    await waitFor(() => expect(ctx.docs.get(ctx.project.id + '/draft')).toBeDefined());
    const doc = ctx.docs.get(ctx.project.id + '/draft')?.data as Record<string, Record<string, unknown>[]>;
    const item = doc[field]?.[0];
    if (field === 'hypotheses')
      expect(item).toMatchObject({
        statement: 'Measure invented accuracy',
        kind: 'exploratory',
        claim: null,
        question: null,
      });
    if (field === 'metrics')
      expect(item).toMatchObject({
        name: 'Measure invented accuracy',
        key: 'measure_invented_accuracy',
        protocol: 'Measure invented accuracy',
        bank: null,
      });
    if (field === 'threats')
      expect(item).toMatchObject({ name: 'Measure invented accuracy', mitigation: '', bank: null });
  });
  it('FR-405 hides ' + name + ' suggestions for archived projects', async () => {
    setup(Page, { readOnly: true });
    await screen.findByText('Đã lưu trữ · chỉ đọc');
    expect(screen.queryByRole('button', { name: 'Gợi ý từ bảng so sánh' })).not.toBeInTheDocument();
  });
}
