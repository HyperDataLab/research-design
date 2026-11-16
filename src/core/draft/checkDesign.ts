import { findClaimType, findDesign, findThreat } from '../bank/readSnapshot';
import type { BankDoc } from '../bank/snapshot';
import type { Draft } from './schema';

export type DesignFlag =
  | { rule: 'DS-01'; subject: string; claim: string; design: string }
  | { rule: 'DS-02' | 'DS-03' | 'DS-04'; subject: string }
  | {
      rule: 'DS-05';
      subject: string;
      reference: 'design' | 'threat' | 'claim';
      id: string;
      reason: 'no_snapshot' | 'missing' | 'other_release';
    };

export function checkDesign(draft: Draft, bank: BankDoc | null): DesignFlag[] {
  const flags: DesignFlag[] = [];
  const ref = draft.design?.bank;
  const design = ref && findDesign(bank, ref.id);
  for (const h of draft.hypotheses) {
    if (h.claim && design && !design.supports.includes(h.claim))
      flags.push({ rule: 'DS-01', subject: h.id, claim: h.claim, design: design.id });
    if (draft.design && h.kind !== 'exploratory' && !h.claim) flags.push({ rule: 'DS-02', subject: h.id });
    if (h.claim && !findClaimType(bank, h.claim))
      flags.push({
        rule: 'DS-05',
        subject: h.id,
        reference: 'claim',
        id: h.claim,
        reason: bank ? 'missing' : 'no_snapshot',
      });
  }
  if (draft.design && draft.design.assignment === null) flags.push({ rule: 'DS-03', subject: 'design' });
  if (ref) {
    const reason = !bank
      ? 'no_snapshot'
      : ref.release !== bank.release
        ? 'other_release'
        : !design
          ? 'missing'
          : null;
    if (reason) flags.push({ rule: 'DS-05', subject: 'design', reference: 'design', id: ref.id, reason });
  }
  for (const t of draft.threats) {
    if (!t.mitigation.trim()) flags.push({ rule: 'DS-04', subject: t.id });
    if (t.bank) {
      const reason = !bank
        ? 'no_snapshot'
        : t.bank.release !== bank.release
          ? 'other_release'
          : !findThreat(bank, t.bank.id)
            ? 'missing'
            : null;
      if (reason) flags.push({ rule: 'DS-05', subject: t.id, reference: 'threat', id: t.bank.id, reason });
    }
  }
  return flags.sort((a, b) => a.rule.localeCompare(b.rule) || a.subject.localeCompare(b.subject));
}
