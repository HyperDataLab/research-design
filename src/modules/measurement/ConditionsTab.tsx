import type { DraftCondition } from '@/core/draft/schema';
import styles from './Page.module.css';

export function ConditionsTab({ item }: { item: DraftCondition }) {
  return (
    <p className={styles.mono}>
      {Object.entries(item.params)
        .map(([k, v]) => `${k} = ${String(v)}`)
        .join(' · ')}
    </p>
  );
}
