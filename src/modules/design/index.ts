import { lazy } from 'react';
import { FlaskConical } from 'lucide-react';
import type { ModuleDefinition } from '@/app/moduleTypes';

const design: ModuleDefinition = {
  id: 'design',
  group: 'design',
  order: 2,
  scope: 'project',
  path: 'design',
  status: 'ready',
  icon: FlaskConical,
  label: 'Thiết kế nghiên cứu',
  summary: 'Chọn thiết kế, xem nó cho phép kết luận gì, ghi mối đe doạ và cách giảm.',
  page: lazy(() => import('./Page')),
};
export default design;
