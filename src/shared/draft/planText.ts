import type { PlanFlag } from '@/core/draft/checkPlan';
import type { Draft } from '@/core/draft/schema';

const methods: Record<string, [string, string]> = {
  descriptive: ['thống kê mô tả', 'Tóm tắt các biến được chọn.'],
  ttest_independent: ['kiểm định t độc lập', 'So sánh trung bình của hai nhóm độc lập.'],
  ttest_paired: ['kiểm định t cặp', 'So sánh trung bình của hai nhóm ghép cặp.'],
  ttest_welch: ['kiểm định t Welch', 'So sánh trung bình của hai nhóm độc lập.'],
  correlation_pearson: ['tương quan Pearson', 'Đo tương quan tuyến tính giữa các biến.'],
  correlation_spearman: ['tương quan Spearman', 'Đo tương quan thứ hạng giữa các biến.'],
  anova_oneway: ['ANOVA một nhân tố', 'So sánh trung bình giữa các nhóm.'],
  anova_repeated: ['ANOVA đo lặp', 'So sánh trung bình giữa các phép đo lặp.'],
  mann_whitney: ['Mann–Whitney', 'So sánh hai nhóm độc lập theo thứ hạng.'],
  wilcoxon_signed_rank: ['Wilcoxon dấu hạng', 'So sánh hai nhóm ghép cặp theo thứ hạng.'],
  kruskal_wallis: ['Kruskal–Wallis', 'So sánh nhiều nhóm độc lập theo thứ hạng.'],
  friedman: ['Friedman', 'So sánh nhiều phép đo lặp theo thứ hạng.'],
  posthoc_pairwise: ['so sánh từng cặp', 'So sánh từng cặp nhóm.'],
  regression_linear: ['hồi quy tuyến tính', 'Mô hình hoá liên hệ tuyến tính giữa các biến.'],
  reliability: ['độ tin cậy', 'Đánh giá độ tin cậy của thang đo.'],
};
export const methodWords = (method: string) => methods[method]?.[0] ?? method;
export const capitaliseFirst = (value: string) => value.charAt(0).toLocaleUpperCase('vi') + value.slice(1);
export const methodHint = (method: string) => methods[method]?.[1] ?? method;
const missing: Record<string, string> = {
  listwise: 'loại theo danh sách',
  pairwise: 'loại theo từng cặp',
  fail: 'dừng khi thiếu',
};
const corrections: Record<string, string> = {
  none: 'không',
  bonferroni: 'Bonferroni',
  holm: 'Holm',
  fdr_bh: 'FDR Benjamini–Hochberg',
};
export const missingPolicyWords = (value: string) => missing[value] ?? value;
export const correctionWords = (value: string) => corrections[value] ?? value;
export function planFlagText(flag: PlanFlag, draft: Draft): string {
  switch (flag.rule) {
    case 'AN-01':
      return `${flag.subject} chưa có phân tích nào.`;
    case 'AN-02':
      return `${flag.subject} chưa chọn phương pháp.`;
    case 'AN-03':
      return `${flag.subject} chưa chọn biến.`;
    case 'AN-04':
      return `${flag.subject} dùng ${methodWords(flag.method)}, phương pháp so sánh đúng hai điều kiện, nhưng đang có ${flag.count}.`;
    case 'AN-05': {
      const name = draft.conditions.find((c) => c.id === flag.condition)?.name;
      return `${flag.subject} so sánh ${flag.condition}${name ? ` «${name}»` : ''}, điều kiện không nằm trong lưới chạy.`;
    }
    case 'AN-06':
      return `${flag.subject} tham chiếu ${flag.id} không còn tồn tại.`;
    case 'AN-07':
      return `${flag.subject} dùng ${methodWords(flag.method)}, SRD chưa hỗ trợ ở bản đầu.`;
    case 'RM-01': {
      const words: Record<string, string> = {
        mlflowExperiment: 'tên experiment',
        conditions: 'điều kiện',
        datasets: 'dataset',
        seeds: 'seed',
        sampleSizeJustification: 'lý do số lần chạy',
      };
      return `Lưới chạy còn thiếu: ${flag.missing.map((key) => words[key] ?? key).join(', ')}.`;
    }
    case 'RM-02':
      return `Lưới chạy tham chiếu ${flag.id} không còn tồn tại.`;
    case 'RM-03':
      return 'Lưới chạy có nhiều điều kiện nhưng chưa có baseline.';
  }
}
