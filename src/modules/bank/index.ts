import { lazy } from 'react';
import { Boxes } from 'lucide-react';
import type { ModuleDefinition } from '@/app/moduleTypes';

const bank: ModuleDefinition = {
  id: 'bank',
  group: 'design',
  order: 4,
  scope: 'project',
  path: 'bank',
  status: 'ready',
  icon: Boxes,
  label: 'Writing Bank',
  summary: 'Bản chụp Writing Bank của dự án.',
  page: lazy(() => import('./Page')),
};
export default bank;
