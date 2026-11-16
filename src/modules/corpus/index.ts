import { lazy } from 'react';
import { Library } from 'lucide-react';
import type { ModuleDefinition } from '@/app/moduleTypes';
const corpus: ModuleDefinition = {
  id: 'corpus',
  label: 'Tập bài báo',
  summary: 'Các bài đã chọn, kèm paper model nhập từ PaperLab.',
  icon: Library,
  group: 'literature',
  order: 2,
  scope: 'project',
  path: 'corpus',
  status: 'ready',
  page: lazy(() => import('./Page')),
};
export default corpus;
