import { lazy } from 'react';
import { Settings } from 'lucide-react';
import type { ModuleDefinition } from '@/app/moduleTypes';
const settings: ModuleDefinition = {
  id: 'settings',
  label: 'Cài đặt',
  summary: 'Tài khoản, đồng ý gửi dữ liệu cho AI, hạn mức token.',
  icon: Settings,
  group: 'system',
  order: 2,
  path: '/settings',
  status: 'ready',
  page: lazy(() => import('./Page')),
};
export default settings;
