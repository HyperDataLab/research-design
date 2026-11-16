import { lazy } from 'react';
import {
  FlaskConical,
  Grid3x3,
  PackageCheck,
  Ruler,
  Search,
  Sigma,
  Table2,
  type LucideIcon,
} from 'lucide-react';
import type { ModuleDefinition } from '@/app/moduleTypes';

/**
 * Screens of the roadmap that are not built yet. A slice that builds one moves its entry into
 * `src/modules/<id>/index.ts` with its own page and removes it here.
 */
const page = lazy(() => import('./soon/Page'));
const soon = (
  id: string,
  group: ModuleDefinition['group'],
  order: number,
  label: string,
  summary: string,
  icon: LucideIcon,
): ModuleDefinition => ({
  id,
  group,
  order,
  label,
  summary,
  icon,
  path: group === 'system' ? `/${id}` : id,
  ...(group === 'system' ? {} : { scope: 'project' }),
  status: 'soon',
  page,
});

export const planned: ModuleDefinition[] = [
  soon(
    'search',
    'literature',
    1,
    'Tìm bài báo',
    'Tìm theo chủ đề, mở rộng từ bài hạt giống, ghi lý do chọn và loại.',
    Search,
  ),
  soon(
    'evidence',
    'literature',
    3,
    'Bảng so sánh',
    'Mỗi bài một hàng: task, dataset, baseline, metric, thiết kế, kết quả; mỗi ô dẫn về câu gốc.',
    Table2,
  ),
  soon(
    'design',
    'design',
    2,
    'Thiết kế nghiên cứu',
    'Chọn thiết kế, xem nó cho phép kết luận gì, ghi mối đe doạ và cách giảm.',
    FlaskConical,
  ),
  soon(
    'measurement',
    'design',
    3,
    'Đo lường',
    'Khái niệm, biến, metric, đơn vị, hướng tốt và quy trình đo.',
    Ruler,
  ),
  soon(
    'analyses',
    'plan',
    1,
    'Phân tích thống kê',
    'Khai báo trước phép kiểm định cho từng giả thuyết.',
    Sigma,
  ),
  soon(
    'runs',
    'plan',
    2,
    'Ma trận chạy',
    'Điều kiện × dataset × seed, tên experiment và tag MLflow.',
    Grid3x3,
  ),
  soon(
    'package',
    'plan',
    3,
    'Gói kế hoạch',
    'Kiểm tra, đóng băng và xuất gói cho Scientific Research Desktop.',
    PackageCheck,
  ),
];
