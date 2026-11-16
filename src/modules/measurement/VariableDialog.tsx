import { useState } from 'react';
import type { Draft, DraftVariable } from '@/core/draft/schema';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { Select } from '@/shared/ui/Select';
import { TextField } from '@/shared/ui/TextField';
import { word } from './words';
import styles from './Page.module.css';

export function VariableDialog({
  item,
  draft,
  close,
  save,
}: {
  item?: DraftVariable;
  draft: Draft;
  close: () => void;
  save: (v: Omit<DraftVariable, 'id'>) => Promise<boolean>;
}) {
  const [value, setValue] = useState<Omit<DraftVariable, 'id'>>(
    item
      ? {
          name: item.name,
          role: item.role,
          construct: item.construct,
          metric: item.metric,
          levels: item.levels,
        }
      : { name: '', role: 'independent', construct: '', metric: null, levels: [] },
  );
  const [levels, setLevels] = useState(value.levels.join(', '));
  return (
    <Dialog
      title={item ? 'Sửa biến' : 'Thêm biến'}
      description="Mô tả biến trong nghiên cứu."
      onClose={close}
    >
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void save({
            ...value,
            levels: levels
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          }).then((ok) => {
            if (ok) close();
          });
        }}
      >
        <TextField
          label="Tên"
          required
          value={value.name}
          onChange={(e) => setValue({ ...value, name: e.target.value })}
        />
        <Select
          label="Vai trò"
          value={value.role}
          onChange={(e) =>
            setValue({ ...value, role: e.target.value as DraftVariable['role'], metric: null })
          }
        >
          {['independent', 'dependent', 'control', 'covariate'].map((r) => (
            <option value={r} key={r}>
              {word(r)}
            </option>
          ))}
        </Select>
        <TextField
          label="Khái niệm"
          value={value.construct}
          onChange={(e) => setValue({ ...value, construct: e.target.value })}
        />
        {(value.role === 'dependent' || value.role === 'covariate') && (
          <Select
            label="Metric"
            value={value.metric ?? ''}
            onChange={(e) => setValue({ ...value, metric: e.target.value || null })}
          >
            <option value="">Chưa có metric</option>
            {draft.metrics.map((m) => (
              <option value={m.id} key={m.id}>
                {m.id} {m.name}
              </option>
            ))}
          </Select>
        )}
        {value.role === 'independent' && (
          <TextField label="Các mức" value={levels} onChange={(e) => setLevels(e.target.value)} />
        )}
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
