import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/shared/ui/Badge';
import { useConsent } from './useConsent';
export function ConsentGate({ children, over = false }: { children: ReactNode; over?: boolean }) {
  const { state, ready } = useConsent();
  if (ready && !over) return <>{children}</>;
  return (
    <div>
      <p>
        {over
          ? 'Đã hết hạn mức token hôm nay.'
          : 'Cần đồng ý gửi dữ liệu cho AI trước khi dùng tính năng này.'}{' '}
        <Link to="/settings">Cài đặt</Link>
      </p>
      {state && !state.configured && <Badge tone="warning">AI chưa được cấu hình</Badge>}
    </div>
  );
}
