import { lazy } from 'react';
import { Search, Table2, type LucideIcon } from 'lucide-react';
import type { ModuleDefinition } from '@/app/moduleTypes';

/**
 * Screens of the roadmap that are not built yet. A slice that builds one moves its entry into
 * `src/modules/<id>/index.ts` with its own page and removes it here.
 */
const page = lazy(() => import('./soon/Page'));
const soon = (
  id: string,
  group: ModuleDefinition['group'],
  order: number,
  label: string,
  summary: string,
  icon: LucideIcon,
): ModuleDefinition => ({
  id,
  group,
  order,
  label,
  summary,
  icon,
  path: group === 'system' ? `/${id}` : id,
  ...(group === 'system' ? {} : { scope: 'project' }),
  status: 'soon',
  page,
});

export const planned: ModuleDefinition[] = [
  soon(
    'search',
    'literature',
    1,
    'Tìm bài báo',
    'Chọn trong các bài PaperLab đã công bố, ghi lý do chọn và loại. Tìm và lấy bài mới thực hiện ở PaperLab.',
    Search,
  ),
  soon(
    'evidence',
    'literature',
    3,
    'Bảng so sánh',
    'Mỗi bài một hàng: task, dataset, baseline, metric, thiết kế, kết quả; mỗi ô dẫn về câu gốc.',
    Table2,
  ),
];
