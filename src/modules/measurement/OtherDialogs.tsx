import { useState } from 'react';
import type { DraftCondition, DraftDataset } from '@/core/draft/schema';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Dialog } from '@/shared/ui/Dialog';
import { TextField } from '@/shared/ui/TextField';
import styles from './Page.module.css';

export function DatasetDialog({
  initial,
  close,
  save,
}: {
  initial: Omit<DraftDataset, 'id'>;
  close: () => void;
  save: (v: Omit<DraftDataset, 'id'>) => Promise<boolean>;
}) {
  const [v, set] = useState(initial);
  return (
    <Dialog title="Dataset" description="Mô tả dataset." onClose={close}>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void save(v).then((ok) => {
            if (ok) close();
          });
        }}
      >
        <TextField
          label="Tên"
          required
          value={v.name}
          onChange={(e) => set({ ...v, name: e.target.value })}
        />
        <TextField label="Nguồn" value={v.source} onChange={(e) => set({ ...v, source: e.target.value })} />
        {(['version', 'split', 'sha256'] as const).map((field) => (
          <TextField
            key={field}
            label={{ version: 'Phiên bản', split: 'Split', sha256: 'SHA-256' }[field]}
            value={v[field] ?? ''}
            onChange={(e) => set({ ...v, [field]: e.target.value || null })}
          />
        ))}
        <div className={styles.actions}>
          <Button onClick={close}>Hủy</Button>
          <Button type="submit" variant="primary">
            Lưu
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
export function ConditionDialog({
  initial,
  close,
  save,
}: {
  initial?: DraftCondition;
  close: () => void;
  save: (v: Omit<DraftCondition, 'id'>) => Promise<boolean>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [baseline, setBaseline] = useState(initial?.baseline ?? false);
  const [params, setParams] = useState<[string, string][]>(
    Object.entries(initial?.params ?? {}).map(([k, v]) => [k, String(v)]),
  );
  const convert = (s: string): string | number | boolean =>
    s === 'true' ? true : s === 'false' ? false : s.trim() && Number.isFinite(Number(s)) ? Number(s) : s;
  return (
    <Dialog title="Điều kiện" description="Mô tả điều kiện chạy." onClose={close}>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void save({
            name,
            baseline,
            params: Object.fromEntries(params.filter(([k]) => k.trim()).map(([k, v]) => [k, convert(v)])),
          }).then((ok) => {
            if (ok) close();
          });
        }}
      >
        <TextField label="Tên" required value={name} onChange={(e) => setName(e.target.value)} />
        <Checkbox checked={baseline} onChange={(e) => setBaseline(e.target.checked)}>
          Là baseline
        </Checkbox>
        {params.map(([key, value], i) => (
          <div key={i}>
            <TextField
              label="Tên tham số"
              value={key}
              onChange={(e) => setParams(params.map((p, n) => (n === i ? [e.target.value, p[1]] : p)))}
            />
            <TextField
              label="Giá trị"
              value={value}
              onChange={(e) => setParams(params.map((p, n) => (n === i ? [p[0], e.target.value] : p)))}
            />
            <Button onClick={() => setParams(params.filter((_, n) => n !== i))}>Xoá tham số</Button>
          </div>
        ))}
        <Button onClick={() => setParams([...params, ['', '']])}>Thêm tham số</Button>
        <div className={styles.actions}>
          <Button onClick={close}>Hủy</Button>
          <Button type="submit" variant="primary">
            Lưu
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
