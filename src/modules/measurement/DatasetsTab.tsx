import { findBenchmark } from '@/core/bank/readSnapshot';
import type { BankDoc } from '@/core/bank/snapshot';
import type { DraftDataset } from '@/core/draft/schema';
import { Badge } from '@/shared/ui/Badge';
import { word } from './words';
import styles from './Page.module.css';

export function DatasetsTab({ item, bank }: { item: DraftDataset; bank: BankDoc | null }) {
  const benchmark = item.benchmark && findBenchmark(bank, item.benchmark.id);
  return (
    <>
      <p className={styles.quiet}>
        {item.source} · {item.version} · {item.split}
      </p>
      {benchmark && (
        <>
          <p>
            {word(benchmark.lifecycle)} · {benchmark.knownFlaws.join(' · ')}
          </p>
          {benchmark.status === 'draft' && <Badge>Bản nháp của bank</Badge>}
        </>
      )}
    </>
  );
}
