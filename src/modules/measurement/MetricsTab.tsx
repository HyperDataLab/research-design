import type { BankDoc } from '@/core/bank/snapshot';
import { findMetric } from '@/core/bank/readSnapshot';
import type { DraftMetric } from '@/core/draft/schema';
import { Badge } from '@/shared/ui/Badge';
import { word } from './words';
import styles from './Page.module.css';

export function MetricsTab({ item, bank }: { item: DraftMetric; bank: BankDoc | null }) {
  return (
    <>
      <p className={styles.quiet}>
        <span className={styles.mono}>{item.key || 'chưa có key'}</span> · {item.unit || 'chưa có đơn vị'} ·{' '}
        {item.goal ? word(item.goal) : 'chưa chọn hướng tốt'} ·{' '}
        {item.aggregation ? word(item.aggregation) : 'chưa chọn cách gộp'}
      </p>
      {item.bank && findMetric(bank, item.bank.id)?.status === 'draft' && <Badge>Bản nháp của bank</Badge>}
    </>
  );
}
