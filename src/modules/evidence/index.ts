import { lazy } from 'react';
import { Table2 } from 'lucide-react';
import type { ModuleDefinition } from '@/app/moduleTypes';

const evidence: ModuleDefinition = {
  id: 'evidence',
  label: 'Bảng so sánh',
  summary: 'So sánh dữ kiện từ các bài báo.',
  icon: Table2,
  group: 'literature',
  order: 3,
  scope: 'project',
  path: 'evidence',
  status: 'ready',
  page: lazy(() => import('./Page')),
};
export default evidence;
