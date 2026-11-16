import { lazy } from 'react';
import { Folder } from 'lucide-react';
import type { ModuleDefinition } from '@/app/moduleTypes';
const projects: ModuleDefinition = {
  id: 'projects',
  label: 'Dự án',
  summary: 'Tạo và quản lý các dự án nghiên cứu.',
  icon: Folder,
  group: 'home',
  order: 1,
  path: '/projects',
  status: 'ready',
  page: lazy(() => import('./Page')),
};
export default projects;
