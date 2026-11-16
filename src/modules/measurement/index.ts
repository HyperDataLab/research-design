import { lazy } from 'react';
import { Ruler } from 'lucide-react';
import type { ModuleDefinition } from '@/app/moduleTypes';

const measurement: ModuleDefinition = {
  id: 'measurement',
  group: 'design',
  order: 3,
  scope: 'project',
  path: 'measurement',
  status: 'ready',
  icon: Ruler,
  label: 'Đo lường',
  summary: 'Khái niệm, biến, metric, đơn vị, hướng tốt và quy trình đo.',
  page: lazy(() => import('./Page')),
};
export default measurement;
