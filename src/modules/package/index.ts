import { lazy } from 'react';
import { PackageCheck } from 'lucide-react';
import type { ModuleDefinition } from '@/app/moduleTypes';

const definition: ModuleDefinition = {
  id: 'package',
  group: 'plan',
  order: 3,
  scope: 'project',
  path: 'package',
  status: 'ready',
  icon: PackageCheck,
  label: 'Gói kế hoạch',
  summary: 'Kiểm tra, đóng băng và xuất gói cho Scientific Research Desktop.',
  page: lazy(() => import('./Page')),
};
export default definition;
