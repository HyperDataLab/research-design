import { useState } from 'react';
import { Link } from 'react-router-dom';
import { bankBenchmarks, bankMetrics } from '@/core/bank/readSnapshot';
import type { BankDoc } from '@/core/bank/snapshot';
import { datasetFromBank, metricFromBank } from '@/core/draft/measureOps';
import type { DraftDataset } from '@/core/draft/schema';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Drawer } from '@/shared/ui/Drawer';
import { TextField } from '@/shared/ui/TextField';
import type { MetricInput } from './MetricDialog';
import { claimWord, word } from './words';
import styles from './Page.module.css';

const blankMetric = (): MetricInput => ({
  name: '',
  key: '',
  unit: '',
  goal: null,
  aggregation: null,
  protocol: '',
  bank: null,
  protocolBank: null,
});
const blankDataset = (): Omit<DraftDataset, 'id'> => ({
  name: '',
  source: '',
  version: null,
  split: null,
  sha256: null,
  benchmark: null,
});
export function Pickers({
  kind,
  bank,
  projectId,
  close,
  metric,
  dataset,
}: {
  kind: 'metrics' | 'datasets';
  bank: BankDoc | null;
  projectId: string;
  close: () => void;
  metric: (m: MetricInput) => void;
  dataset: (d: Omit<DraftDataset, 'id'>) => void;
}) {
  const [filter, setFilter] = useState('');
  const [family, setFamily] = useState('');
  const metrics = bankMetrics(bank);
  const text = filter.toLocaleLowerCase();
  return (
    <Drawer open onClose={close} side="right" label={kind === 'metrics' ? 'Chọn metric' : 'Chọn dataset'}>
      <h2>{kind === 'metrics' ? 'Chọn metric' : 'Chọn dataset'}</h2>
      {!bank && (
        <p>
          Chưa có bản chụp. <Link to={`/p/${projectId}/bank`}>Writing Bank</Link>
        </p>
      )}
      {bank && <TextField label="Tìm kiếm" value={filter} onChange={(e) => setFilter(e.target.value)} />}
      {kind === 'metrics' && (
        <>
          {bank && (
            <Chip count={metrics.length} aria-pressed={!family} onClick={() => setFamily('')}>
              Tất cả
            </Chip>
          )}
          {[...new Set(metrics.map((m) => m.family))].map((f) => (
            <Chip
              key={f}
              count={metrics.filter((m) => m.family === f).length}
              aria-pressed={family === f}
              onClick={() => setFamily(f)}
            >
              {word(f)}
            </Chip>
          ))}
          {metrics
            .filter(
              (m) =>
                (!family || m.family === family) &&
                [m.name, ...m.aliases].some((s) => s.toLocaleLowerCase().includes(text)),
            )
            .map((m) => (
              <div className={styles.row} key={m.id}>
                <h3>{m.name}</h3>
                {m.status === 'draft' && <Badge>Bản nháp của bank</Badge>}
                <p>
                  {word(m.family)} · {m.unit || 'không có đơn vị'} · {word(m.direction)}
                </p>
                <p>{m.definition.match(/^.*?[.!?](?:\s|$)/)?.[0].trim() ?? m.definition}</p>
                <p>Nhận định mạnh nhất mà metric tự nó hỗ trợ: {claimWord(m.maxClaim)}</p>
                {m.doesNotSupport.map((s) => (
                  <p key={s}>Không hỗ trợ: {s}</p>
                ))}
                <Button onClick={() => bank && metric(metricFromBank(m, bank.release))}>Dùng</Button>
              </div>
            ))}
          <Button onClick={() => metric(blankMetric())}>Tự mô tả metric</Button>
        </>
      )}
      {kind === 'datasets' && (
        <>
          {bankBenchmarks(bank)
            .filter((b) => b.name.toLocaleLowerCase().includes(text))
            .map((b) => (
              <div className={styles.row} key={b.id}>
                <h3>{b.name}</h3>
                {b.status === 'draft' && <Badge>Bản nháp của bank</Badge>}
                <p>
                  {b.task} · {word(b.lifecycle)}
                </p>
                {b.knownFlaws.map((s) => (
                  <p key={s}>{s}</p>
                ))}
                <Button onClick={() => bank && dataset(datasetFromBank(b, bank.release))}>Dùng</Button>
              </div>
            ))}
          <Button onClick={() => dataset(blankDataset())}>Tự mô tả dataset</Button>
        </>
      )}
    </Drawer>
  );
}
