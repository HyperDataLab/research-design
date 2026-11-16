import { findDesign, findThreat, findMetric, findProtocol, findBenchmark } from '../bank/readSnapshot';
import { bankRefs } from './bankRefs';
import type { BankDoc, BankDesign } from '../bank/snapshot';
import type { Draft, DraftDesign, DraftHypothesis, DraftQuestion, DraftThreat } from './schema';

export type DraftError =
  | 'invalid_text'
  | 'unknown_question'
  | 'unknown_hypothesis'
  | 'unknown_threat'
  | 'has_hypotheses'
  | 'duplicate_threat'
  | 'no_design'
  | 'unknown_variable'
  | 'unknown_metric'
  | 'unknown_dataset'
  | 'unknown_condition'
  | 'in_use'
  | 'wrong_role'
  | 'invalid_key'
  | 'invalid_hash'
  | 'unknown_analysis'
  | 'invalid_alpha'
  | 'too_many_seeds';
export type DraftResult = { ok: true; doc: Draft } | { ok: false; error: DraftError };
type Q = Omit<DraftQuestion, 'id'>;
type H = Pick<DraftHypothesis, 'statement' | 'kind' | 'question' | 'claim'>;
type T = Omit<DraftThreat, 'id'>;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const ok = (doc: Draft): DraftResult => ({ ok: true, doc });
const fail = (error: DraftError): DraftResult => ({ ok: false, error });
export function setPlanTitle(doc: Draft, title: string): DraftResult {
  return ok({ ...doc, planTitle: title.trim() });
}
export function addQuestion(doc: Draft, input: Q): DraftResult {
  const text = input.text.trim();
  if (!text) return fail('invalid_text');
  const question = {
    ...input,
    text,
    gap: input.gap.trim(),
    papers: [...input.papers],
    id: `q-${doc.next.q}`,
  };
  return ok({ ...doc, next: { ...doc.next, q: doc.next.q + 1 }, questions: [...doc.questions, question] });
}
export function editQuestion(doc: Draft, id: string, input: Q): DraftResult {
  const old = doc.questions.find((x) => x.id === id);
  if (!old) return fail('unknown_question');
  const text = input.text.trim();
  if (!text) return fail('invalid_text');
  const entry = { ...old, ...input, text, gap: input.gap.trim(), papers: [...input.papers] };
  return same(old, entry)
    ? ok(doc)
    : ok({ ...doc, questions: doc.questions.map((x) => (x.id === id ? entry : x)) });
}
export function removeQuestion(doc: Draft, id: string): DraftResult {
  if (!doc.questions.some((x) => x.id === id)) return fail('unknown_question');
  if (doc.hypotheses.some((x) => x.question === id)) return fail('has_hypotheses');
  return ok({ ...doc, questions: doc.questions.filter((x) => x.id !== id) });
}
export function addHypothesis(doc: Draft, input: H): DraftResult {
  const statement = input.statement.trim();
  if (!statement) return fail('invalid_text');
  if (input.question && !doc.questions.some((x) => x.id === input.question)) return fail('unknown_question');
  return ok({
    ...doc,
    next: { ...doc.next, h: doc.next.h + 1 },
    hypotheses: [
      ...doc.hypotheses,
      { ...input, statement, id: `h-${doc.next.h}`, independent: [], dependent: [] },
    ],
  });
}
export function editHypothesis(doc: Draft, id: string, input: H): DraftResult {
  const old = doc.hypotheses.find((x) => x.id === id);
  if (!old) return fail('unknown_hypothesis');
  const statement = input.statement.trim();
  if (!statement) return fail('invalid_text');
  if (input.question && !doc.questions.some((x) => x.id === input.question)) return fail('unknown_question');
  const entry = { ...old, ...input, statement };
  return same(old, entry)
    ? ok(doc)
    : ok({ ...doc, hypotheses: doc.hypotheses.map((x) => (x.id === id ? entry : x)) });
}
export function removeHypothesis(doc: Draft, id: string): DraftResult {
  if (!doc.hypotheses.some((x) => x.id === id)) return fail('unknown_hypothesis');
  if (doc.analyses.some((a) => a.hypothesis === id)) return fail('in_use');
  return ok({ ...doc, hypotheses: doc.hypotheses.filter((x) => x.id !== id) });
}
export function setDesign(doc: Draft, design: DraftDesign | null): DraftResult {
  if (design && !design.name.trim()) return fail('invalid_text');
  const value = design && { ...design, name: design.name.trim() };
  return same(doc.design, value) ? ok(doc) : ok({ ...doc, design: value });
}
export function setAssignment(doc: Draft, assignment: DraftDesign['assignment']): DraftResult {
  if (!doc.design) return fail('no_design');
  return setDesign(doc, { ...doc.design, assignment });
}
export function designFromBank(design: BankDesign, release: string): DraftDesign {
  return {
    name: design.name,
    assignment: design.assignment === 'either' ? null : design.assignment,
    bank: { id: design.id, release },
  };
}
export function addThreat(doc: Draft, input: T): DraftResult {
  const name = input.name.trim();
  if (!name) return fail('invalid_text');
  if (input.bank && doc.threats.some((x) => x.bank?.id === input.bank?.id)) return fail('duplicate_threat');
  return ok({
    ...doc,
    next: { ...doc.next, t: doc.next.t + 1 },
    threats: [...doc.threats, { ...input, name, mitigation: input.mitigation.trim(), id: `t-${doc.next.t}` }],
  });
}
export function editThreat(doc: Draft, id: string, input: Pick<T, 'name' | 'mitigation'>): DraftResult {
  const old = doc.threats.find((x) => x.id === id);
  if (!old) return fail('unknown_threat');
  const name = input.name.trim();
  if (!name) return fail('invalid_text');
  const entry = { ...old, name, mitigation: input.mitigation.trim() };
  return same(old, entry)
    ? ok(doc)
    : ok({ ...doc, threats: doc.threats.map((x) => (x.id === id ? entry : x)) });
}
export function removeThreat(doc: Draft, id: string): DraftResult {
  if (!doc.threats.some((x) => x.id === id)) return fail('unknown_threat');
  return ok({ ...doc, threats: doc.threats.filter((x) => x.id !== id) });
}

export function repin(doc: Draft, bank: BankDoc): DraftResult {
  const find = {
    design: findDesign,
    threat: findThreat,
    metric: findMetric,
    protocol: findProtocol,
    benchmark: findBenchmark,
  };
  const resolve = (id: string, exists: (id: string) => boolean) => {
    const seen = new Set([id]);
    let current = id;
    for (let step = 0; step < 10 && !exists(current); step++) {
      const next = bank.aliases[current];
      if (!next || seen.has(next)) return null;
      seen.add(next);
      current = next;
    }
    return exists(current) ? current : null;
  };
  const eligible = bankRefs(doc);
  const update = (
    subject: string,
    reference: (typeof eligible)[number]['reference'],
    ref: { id: string; release: string } | null,
  ) => {
    if (!ref || !eligible.some((r) => r.subject === subject && r.reference === reference)) return ref;
    const id = resolve(ref.id, (candidate) => Boolean(find[reference](bank, candidate)));
    return id ? { id, release: bank.release } : ref;
  };
  const result = {
    ...doc,
    hypotheses: doc.hypotheses.map((h) => ({
      ...h,
      claim: h.claim
        ? (resolve(h.claim, (id) => bank.collections['claim-types'].some((c) => c.id === id)) ?? h.claim)
        : null,
    })),
    design: doc.design && { ...doc.design, bank: update('design', 'design', doc.design.bank) },
    threats: doc.threats.map((t) => ({ ...t, bank: update(t.id, 'threat', t.bank) })),
    metrics: doc.metrics.map((m) => ({
      ...m,
      bank: update(m.id, 'metric', m.bank),
      protocolBank: update(m.id, 'protocol', m.protocolBank),
    })),
    datasets: doc.datasets.map((d) => ({ ...d, benchmark: update(d.id, 'benchmark', d.benchmark) })),
  };
  return ok(same(doc, result) ? doc : result);
}
