import type { ChainFlag } from '@/core/draft/checkChain';
import type { Draft } from '@/core/draft/schema';

export function chainFlagText(flag: ChainFlag, draft: Draft): string {
  const named = (items: { id: string; name: string }[]) =>
    `${flag.subject} «${items.find((item) => item.id === flag.subject)?.name ?? ''}»`;
  switch (flag.rule) {
    case 'CH-01':
      return `${flag.subject} chưa gắn biến phụ thuộc.`;
    case 'CH-02':
      return `${named(draft.variables)} là biến phụ thuộc của ${flag.hypothesis} nhưng chưa có metric.`;
    case 'CH-03':
      return `${flag.subject} tham chiếu biến ${flag.variable} ${flag.which === 'missing' ? 'không tồn tại' : 'không đúng vai trò'}.`;
    case 'CH-04': {
      const fields: Record<string, string> = {
        key: 'key',
        unit: 'đơn vị',
        goal: 'hướng tốt',
        aggregation: 'cách gộp',
        protocol: 'quy trình đo',
      };
      return `${named(draft.metrics)} còn thiếu: ${flag.missing.map((field) => fields[field] ?? field).join(', ')}.`;
    }
    case 'CH-05':
      return `${named(draft.metrics)} có key ${flag.reason === 'duplicate' ? 'trùng với metric khác' : 'dành riêng cho run tag'}.`;
    case 'CH-06':
      return `${named(draft.variables)} có ít hơn hai mức.`;
    case 'CH-07':
      return `${named(draft.datasets)} chưa có nguồn.`;
    case 'CH-08':
      return `${named(draft.variables)} tham chiếu metric không tồn tại.`;
    case 'CH-09':
      return 'Có nhiều điều kiện nhưng chưa chọn baseline.';
  }
}
