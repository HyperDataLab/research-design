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
        <span className={styles.mono}>{item.key}</span> · {item.unit} · {word(item.goal)} ·{' '}
        {word(item.aggregation)}
      </p>
      {item.bank && findMetric(bank, item.bank.id)?.status === 'draft' && <Badge>Bản nháp của bank</Badge>}
    </>
  );
}
