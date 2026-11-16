import { lazy } from 'react';
import { House } from 'lucide-react';
import type { ModuleDefinition } from '@/app/moduleTypes';
const module: ModuleDefinition = {
  id: 'home',
  label: 'Tổng quan',
  summary: 'Các bước từ tài liệu đến gói kế hoạch thí nghiệm.',
  icon: House,
  path: '/',
  group: 'home',
  order: 0,
  status: 'ready',
  page: lazy(() => import('./Page')),
};
export default module;
