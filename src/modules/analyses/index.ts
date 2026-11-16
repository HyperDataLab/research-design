import { lazy } from 'react';
import { Sigma } from 'lucide-react';
import type { ModuleDefinition } from '@/app/moduleTypes';

const analyses: ModuleDefinition = {
  id: 'analyses',
  group: 'plan',
  order: 1,
  scope: 'project',
  path: 'analyses',
  status: 'ready',
  icon: Sigma,
  label: 'Phân tích thống kê',
  summary: 'Khai báo trước phép kiểm định cho từng giả thuyết.',
  page: lazy(() => import('./Page')),
};
export default analyses;
