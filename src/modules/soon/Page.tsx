import { Link } from 'react-router-dom';
import { Empty } from '@/shared/ui/StateNote';

/** Route target of every screen that is planned but not built. The sidebar does not link to it. */
export default function SoonPage() {
  return (
    <Empty title="Màn hình này chưa được xây dựng" hint="Xem thứ tự các bước ở Tổng quan.">
      <Link to="/">Về Tổng quan</Link>
    </Empty>
  );
}
