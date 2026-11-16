import type { Draft } from './schema';

export type BankReference = {
  subject: string;
  reference: 'design' | 'threat' | 'metric' | 'protocol' | 'benchmark';
  id: string;
  release: string;
};

export function bankRefs(draft: Draft): BankReference[] {
  const refs: BankReference[] = [];
  const add = (
    subject: string,
    reference: BankReference['reference'],
    ref: { id: string; release: string } | null,
  ) => {
    if (ref) refs.push({ subject, reference, ...ref });
  };
  add('design', 'design', draft.design?.bank ?? null);
  for (const t of draft.threats) add(t.id, 'threat', t.bank);
  for (const m of draft.metrics) {
    add(m.id, 'metric', m.bank);
    add(m.id, 'protocol', m.protocolBank);
  }
  for (const d of draft.datasets) add(d.id, 'benchmark', d.benchmark);
  return refs;
}
