import type { Missing } from '@/core/draft/freezeGate';
import type { Draft } from '@/core/draft/schema';
import type { ExperimentPlan } from '@/core/plan/schema';
import { TWO_SAMPLE, type PlanIssue } from '@/core/plan/validatePlan';

const rules: Record<string, string> = {
  'PP-01': 'Mỗi đối tượng phải có mã duy nhất.',
  'PP-02': 'Mọi liên kết phải trỏ tới đối tượng trong kế hoạch.',
  'PP-03': 'Lưới chạy phải liệt kê mỗi giá trị một lần và có số lượt chạy đúng.',
  'PP-04': 'Mỗi thước đo phải dùng khóa MLflow riêng và không trùng thẻ hệ thống.',
  'PP-05': 'Mỗi giả thuyết xác nhận phải có phân tích định trước.',
  'PP-06': 'Mỗi biến phụ thuộc phải có thước đo.',
  'PP-07': 'Phép so sánh nên có điều kiện cơ sở.',
  'PP-08': 'Phương pháp phân tích nên được SRD hỗ trợ.',
  'PP-09': 'Phiên bản sau phải ghi thay đổi so với phiên bản trước.',
  'PP-10': 'Phân tích phải so sánh điều kiện trong lưới và đúng số lượng cho phương pháp.',
};
export const ruleText = (rule: string) => rules[rule] ?? 'Quy tắc kế hoạch chưa được nhận diện.';
export function issueText(issue: PlanIssue, plan: ExperimentPlan): string {
  const subject = issue.subject ?? 'Kế hoạch';
  if (issue.rule === 'PP-02') {
    const reference = /refers to the missing (\w+) ([^.]+)\./.exec(issue.message);
    const kinds: Record<string, string> = {
      hypothesis: 'giả thuyết',
      variable: 'biến',
      metric: 'thước đo',
      dataset: 'tập dữ liệu',
      condition: 'điều kiện',
      analysis: 'phân tích',
    };
    if (reference?.[1] && reference[2])
      return `${subject} liên kết đến ${kinds[reference[1]] ?? 'đối tượng'} ${reference[2]} không có trong kế hoạch.`;
  }
  if (issue.rule === 'PP-03') {
    const duplicate = /runMatrix\.(\w+) lists (.+) twice\./.exec(issue.message);
    if (duplicate?.[1] && duplicate[2])
      return `Lưới chạy liệt kê ${duplicate[2]} hai lần trong ${fields[duplicate[1]] ?? duplicate[1]}.`;
    return `Lưới chạy ghi ${plan.runMatrix.expectedRuns} lượt nhưng có ${plan.runMatrix.conditions.length * plan.runMatrix.datasets.length * plan.runMatrix.seeds.length} ô.`;
  }
  if (issue.rule === 'PP-04') {
    const key = /"([^"]+)"/.exec(issue.message)?.[1];
    if (key)
      return issue.subject
        ? `${subject} dùng khóa ${key} dành cho thẻ hệ thống.`
        : `Nhiều thước đo dùng khóa MLflow ${key}.`;
  }
  if (issue.rule === 'PP-05') return `${subject} chưa có phân tích định trước.`;
  if (issue.rule === 'PP-06') return `${subject} chưa có thước đo.`;
  if (issue.rule === 'PP-07') return 'Lưới chạy so sánh các điều kiện nhưng chưa có điều kiện cơ sở.';
  if (issue.rule === 'PP-08') return `${subject} dùng phương pháp SRD chưa hỗ trợ trong P0.`;
  if (issue.rule === 'PP-09')
    return plan.planVersion === 1
      ? 'Phiên bản 1 không có phiên bản trước để ghi thay đổi.'
      : `Phiên bản ${plan.planVersion} cần ghi thay đổi so với phiên bản trước.`;
  if (issue.rule === 'PP-10') {
    const analysis = plan.analyses.find((a) => a.id === issue.subject);
    const absent = analysis?.conditions.find(
      (c) => plan.conditions.some((x) => x.id === c) && !plan.runMatrix.conditions.includes(c),
    );
    if (absent && issue.message.includes(absent))
      return `${subject} so sánh ${absent}, điều kiện không nằm trong lưới chạy.`;
    if (analysis && TWO_SAMPLE.includes(analysis.method)) return `${subject} cần so sánh đúng hai điều kiện.`;
  }
  return `${subject}: ${ruleText(issue.rule)}`;
}
const names: Record<Missing['code'], string> = {
  no_hypotheses: 'Chưa có giả thuyết',
  no_variables: 'Chưa có biến',
  no_metrics: 'Chưa có thước đo',
  no_datasets: 'Chưa có tập dữ liệu',
  no_conditions: 'Chưa có điều kiện',
  hypothesis_without_dependent: 'chưa có biến phụ thuộc',
  metric_incomplete: 'chưa hoàn thành các trường',
  dataset_without_source: 'chưa ghi nguồn',
  analysis_without_method: 'chưa chọn phương pháp',
  analysis_without_variables: 'chưa chọn biến',
  grid_incomplete: 'Lưới chạy chưa hoàn thành các trường',
  design_without_assignment: 'Thiết kế chưa có cách phân nhóm',
  threat_without_mitigation: 'chưa ghi cách giảm',
  other: 'Kế hoạch chưa hợp lệ',
};
const fields: Record<string, string> = {
  key: 'khóa MLflow',
  unit: 'đơn vị',
  goal: 'mục tiêu',
  aggregation: 'cách tổng hợp',
  protocol: 'quy trình',
  mlflowExperiment: 'tên thí nghiệm MLflow',
  conditions: 'điều kiện',
  datasets: 'tập dữ liệu',
  seeds: 'seed',
  sampleSizeJustification: 'lý do cỡ mẫu',
};
export function missingText(missing: Missing, draft: Draft): string {
  const label = draft.threats.find((t) => t.id === missing.subject)?.name;
  return `${missing.subject ? `${missing.subject}${label ? ` «${label}»` : ''} ` : ''}${names[missing.code]}${missing.fields?.length ? `: ${missing.fields.map((f) => fields[f] ?? f).join(', ')}` : ''}${missing.text ? `: ${missing.text}` : ''}.`;
}
export function missingLink(missing: Missing, projectId: string): string {
  const destination: Record<Missing['code'], string> = {
    no_hypotheses: 'questions',
    hypothesis_without_dependent: 'questions',
    no_variables: 'measurement?tab=variables',
    no_metrics: 'measurement?tab=metrics',
    metric_incomplete: 'measurement?tab=metrics',
    no_datasets: 'measurement?tab=datasets',
    dataset_without_source: 'measurement?tab=datasets',
    no_conditions: 'measurement?tab=conditions',
    analysis_without_method: 'analyses',
    analysis_without_variables: 'analyses',
    grid_incomplete: 'runs',
    design_without_assignment: 'design',
    threat_without_mitigation: 'design',
    other: 'questions',
  };
  return `/p/${encodeURIComponent(projectId)}/${destination[missing.code]}`;
}
