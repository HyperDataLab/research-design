import { expect, it } from 'vitest';
import { emptyDraft } from '@/core/draft/schema';
import { flagText } from './flagText';
it('DS-05 describes design, threat and claim references in words', () => {
  const d = emptyDraft();
  d.design = { name: 'Benchmark evaluation', assignment: null, bank: null };
  d.threats = [{ id: 't-1', name: 'Data leakage', mitigation: '', bank: null }];
  expect(
    flagText(
      {
        rule: 'DS-05',
        subject: 'design',
        reference: 'design',
        id: 'rd.benchmark-evaluation',
        reason: 'missing',
      },
      d,
      null,
    ),
  ).toBe('Thiết kế «Benchmark evaluation» (rd.benchmark-evaluation) không còn trong bản chụp hiện tại.');
  expect(
    flagText(
      { rule: 'DS-05', subject: 't-1', reference: 'threat', id: 'vt.data-leakage', reason: 'missing' },
      d,
      null,
    ),
  ).toBe('t-1 «Data leakage»: mục vt.data-leakage không còn trong bản chụp hiện tại.');
  expect(
    flagText(
      { rule: 'DS-05', subject: 'h-1', reference: 'claim', id: 'ct.causal', reason: 'no_snapshot' },
      d,
      null,
    ),
  ).toBe('h-1: loại nhận định ct.causal chưa đối chiếu được vì dự án chưa có bản chụp Writing Bank.');
});
