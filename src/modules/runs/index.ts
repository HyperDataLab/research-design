import { lazy } from 'react';
import { Grid3x3 } from 'lucide-react';
import type { ModuleDefinition } from '@/app/moduleTypes';

const runs: ModuleDefinition = {
  id: 'runs',
  group: 'plan',
  order: 2,
  scope: 'project',
  path: 'runs',
  status: 'ready',
  icon: Grid3x3,
  label: 'Ma trận chạy',
  summary: 'Điều kiện × dataset × seed, tên experiment và tag MLflow.',
  page: lazy(() => import('./Page')),
};
export default runs;
