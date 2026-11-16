import type { Paper, PapersDoc } from '@/core/papers/papers';
export type Filter = 'all' | Paper['decision'];
export const decisionLabels: Record<Paper['decision'], string> = {
  undecided: 'Chưa quyết định',
  included: 'Đã chọn',
  excluded: 'Đã loại',
};
export function counts(papers: Paper[]): Record<Filter, number> {
  return {
    all: papers.length,
    undecided: papers.filter((p) => p.decision === 'undecided').length,
    included: papers.filter((p) => p.decision === 'included').length,
    excluded: papers.filter((p) => p.decision === 'excluded').length,
  };
}
export function filterPapers(papers: Paper[], filter: Filter) {
  return filter === 'all' ? papers : papers.filter((p) => p.decision === filter);
}
export function logSentences(doc: PapersDoc) {
  const verbs = {
    added: 'đã thêm',
    included: 'đã chọn',
    excluded: 'đã loại',
    undecided: 'đã bỏ quyết định',
    model_imported: 'đã nhập paper model cho',
  };
  return [...doc.log].reverse().map((entry) => {
    const title = doc.papers.find((p) => p.id === entry.paperId)?.title ?? entry.paperId;
    return `${entry.by} ${verbs[entry.action]} «${title}»${entry.reason ? `: ${entry.reason}` : ''} · ${new Date(entry.at).toLocaleString('vi-VN')}`;
  });
}
