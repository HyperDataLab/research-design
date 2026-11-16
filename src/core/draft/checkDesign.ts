import {
  findClaimType,
  findDesign,
  findThreat,
  findMetric,
  findProtocol,
  findBenchmark,
} from '../bank/readSnapshot';
import { bankRefs } from './bankRefs';
import type { BankDoc } from '../bank/snapshot';
import type { Draft } from './schema';

export type DesignFlag =
  | { rule: 'DS-01'; subject: string; claim: string; design: string }
  | { rule: 'DS-02' | 'DS-03' | 'DS-04'; subject: string }
  | {
      rule: 'DS-05';
      subject: string;
      reference: 'design' | 'threat' | 'claim' | 'metric' | 'protocol' | 'benchmark';
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
  for (const t of draft.threats) {
    if (!t.mitigation.trim()) flags.push({ rule: 'DS-04', subject: t.id });
  }
  const find = {
    design: findDesign,
    threat: findThreat,
    metric: findMetric,
    protocol: findProtocol,
    benchmark: findBenchmark,
  };
  for (const item of bankRefs(draft)) {
    const reason = !bank
      ? 'no_snapshot'
      : !find[item.reference](bank, item.id)
        ? 'missing'
        : item.release !== bank.release
          ? 'other_release'
          : null;
    if (reason)
      flags.push({ rule: 'DS-05', subject: item.subject, reference: item.reference, id: item.id, reason });
  }
  return flags.sort(
    (a, b) =>
      a.rule.localeCompare(b.rule) ||
      (a.subject === b.subject
        ? 0
        : a.subject === 'design'
          ? -1
          : b.subject === 'design'
            ? 1
            : a.subject.localeCompare(b.subject, 'en', { numeric: true })),
  );
}
