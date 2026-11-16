import type { ModuleDefinition } from './moduleTypes';

/** Sidebar sections, in the order of the workflow. An empty label means the group has no heading. */
export const GROUPS: { id: ModuleDefinition['group']; label: string }[] = [
  { id: 'home', label: '' },
  { id: 'literature', label: 'Tài liệu' },
  { id: 'design', label: 'Thiết kế' },
  { id: 'plan', label: 'Kế hoạch' },
  { id: 'system', label: '' },
];

export const GROUP_ORDER = GROUPS.map((group) => group.id);
