import { lazy } from 'react';
import { HelpCircle } from 'lucide-react';
import type { ModuleDefinition } from '@/app/moduleTypes';

const questions: ModuleDefinition = {
  id: 'questions',
  group: 'design',
  order: 1,
  scope: 'project',
  path: 'questions',
  status: 'ready',
  label: 'Câu hỏi và giả thuyết',
  summary: 'Câu hỏi nghiên cứu và giả thuyết có mã ổn định, nối với khoảng trống tìm được.',
  icon: HelpCircle,
  page: lazy(() => import('./Page')),
};
export default questions;
