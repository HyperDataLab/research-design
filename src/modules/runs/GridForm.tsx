import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatSeeds, parseSeeds } from '@/core/draft/planOps';
import type { Draft, DraftRunMatrix } from '@/core/draft/schema';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { TextField } from '@/shared/ui/TextField';
import styles from './Page.module.css';

export function GridForm({
  draft,
  projectId,
  readOnly,
  save,
}: {
  draft: Draft;
  projectId: string;
  readOnly: boolean;
  save: (value: DraftRunMatrix) => Promise<boolean>;
}) {
  const [value, setValue] = useState(draft.runMatrix);
  const [seedText, setSeedText] = useState(() => formatSeeds(draft.runMatrix.seeds));
  const [saving, setSaving] = useState(false);
  const parsed = parseSeeds(seedText);
  const next = parsed.ok ? { ...value, seeds: parsed.seeds } : null;
  const changed = next && JSON.stringify(next) !== JSON.stringify(draft.runMatrix);
  const target = `/p/${encodeURIComponent(projectId)}/measurement`;
  const toggle = (field: 'conditions' | 'datasets', id: string) =>
    setValue((old) => ({
      ...old,
      [field]: old[field].includes(id)
        ? old[field].filter((item) => item !== id)
        : [...old[field], id].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })),
    }));
  const conditions = [...draft.conditions].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  const datasets = [...draft.datasets].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  return (
    <div className={styles.form}>
      {readOnly ? (
        <p>
          Tên experiment MLflow: <span className={styles.mono}>{value.mlflowExperiment || 'Chưa ghi'}</span>
        </p>
      ) : (
        <div className={styles.monoInput}>
          <TextField
            label="Tên experiment MLflow"
            value={value.mlflowExperiment}
            onChange={(e) => setValue({ ...value, mlflowExperiment: e.target.value })}
          />
        </div>
      )}
      <div>
        <h3>Điều kiện</h3>
        {conditions.length ? (
          conditions.map((item) =>
            readOnly ? (
              value.conditions.includes(item.id) && (
                <p key={item.id}>
                  <span className={styles.mono}>{item.id}</span> {item.name}{' '}
                  {item.baseline && <Badge>Baseline</Badge>}
                </p>
              )
            ) : (
              <Checkbox
                key={item.id}
                checked={value.conditions.includes(item.id)}
                onChange={() => toggle('conditions', item.id)}
              >
                <span className={styles.mono}>{item.id}</span> {item.name}{' '}
                {item.baseline && <Badge>Baseline</Badge>}
              </Checkbox>
            ),
          )
        ) : (
          <p className={styles.quiet}>
            Chưa có điều kiện nào. <Link to={`${target}?tab=conditions`}>Thêm ở màn Đo lường.</Link>
          </p>
        )}
      </div>
      <div>
        <h3>Dataset</h3>
        {datasets.length ? (
          datasets.map((item) =>
            readOnly ? (
              value.datasets.includes(item.id) && (
                <p key={item.id}>
                  <span className={styles.mono}>{item.id}</span> {item.name}
                </p>
              )
            ) : (
              <Checkbox
                key={item.id}
                checked={value.datasets.includes(item.id)}
                onChange={() => toggle('datasets', item.id)}
              >
                <span className={styles.mono}>{item.id}</span> {item.name}
              </Checkbox>
            ),
          )
        ) : (
          <p className={styles.quiet}>
            Chưa có dataset nào. <Link to={`${target}?tab=datasets`}>Thêm ở màn Đo lường.</Link>
          </p>
        )}
      </div>
      {readOnly ? (
        <p>
          Seed:{' '}
          <span className={styles.mono}>
            {value.seeds.join(', ')} · {value.seeds.length} seed
          </span>
        </p>
      ) : (
        <div>
          <TextField
            label="Seed"
            value={seedText}
            onChange={(e) => setSeedText(e.target.value)}
            error={
              !parsed.ok
                ? parsed.error === 'too_many_seeds'
                  ? 'Tối đa 200 seed.'
                  : 'Seed là các số nguyên không âm hoặc khoảng, ví dụ 0-4, 7.'
                : undefined
            }
          />
          {parsed.ok && (
            <p className={styles.mono}>
              {parsed.seeds.join(', ')} · {parsed.seeds.length} seed
            </p>
          )}
        </div>
      )}
      {readOnly ? (
        <p>Vì sao số lần chạy này là đủ: {value.sampleSizeJustification || 'Chưa ghi'}</p>
      ) : (
        <TextField
          multiline
          label="Vì sao số lần chạy này là đủ"
          value={value.sampleSizeJustification}
          onChange={(e) => setValue({ ...value, sampleSizeJustification: e.target.value })}
        />
      )}
      {!readOnly && (
        <div>
          <Button
            variant="primary"
            disabled={!changed || saving}
            onClick={() => {
              if (next) {
                setSaving(true);
                void save(next).finally(() => setSaving(false));
              }
            }}
          >
            Lưu lưới
          </Button>
        </div>
      )}
    </div>
  );
}
