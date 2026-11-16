import { expect, it } from 'vitest';
import { emptyDraft } from '@/core/draft/schema';
import { flagText } from './flagText';
it('DS-05 describes design, threat and claim references in words', () => {
  const d = emptyDraft();
  d.design = { name: 'Test benchmark', assignment: null, bank: null };
  d.threats = [{ id: 't-1', name: 'Test confound', mitigation: '', bank: null }];
  expect(
    flagText(
      {
        rule: 'DS-05',
        subject: 'design',
        reference: 'design',
        id: 'rd.test-benchmark',
        reason: 'missing',
      },
      d,
      null,
    ),
  ).toBe('Thiết kế «Test benchmark» (rd.test-benchmark) không còn trong bản chụp hiện tại.');
  expect(
    flagText(
      { rule: 'DS-05', subject: 't-1', reference: 'threat', id: 'vt.test-confound', reason: 'missing' },
      d,
      null,
    ),
  ).toBe('t-1 «Test confound»: mục vt.test-confound không còn trong bản chụp hiện tại.');
  expect(
    flagText(
      { rule: 'DS-05', subject: 'h-1', reference: 'claim', id: 'ct.causal', reason: 'no_snapshot' },
      d,
      null,
    ),
  ).toBe('h-1: loại nhận định ct.causal chưa đối chiếu được vì dự án chưa có bản chụp Writing Bank.');
});
