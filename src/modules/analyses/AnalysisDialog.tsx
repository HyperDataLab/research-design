import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SRD_P0_METHODS, SRD_P1_METHODS } from '@/core/plan/schema';
import { TWO_SAMPLE } from '@/core/plan/validatePlan';
import type { Draft, DraftAnalysis } from '@/core/draft/schema';
import { ParamsEditor } from '@/shared/draft/ParamsEditor';
import {
  capitaliseFirst,
  correctionWords,
  methodHint,
  methodWords,
  missingPolicyWords,
} from '@/shared/draft/planText';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Dialog } from '@/shared/ui/Dialog';
import { Select } from '@/shared/ui/Select';
import { TextField } from '@/shared/ui/TextField';
import styles from './Page.module.css';

type Input = Omit<DraftAnalysis, 'id'>;
export function AnalysisDialog({
  draft,
  projectId,
  hypothesis,
  item,
  close,
  save,
}: {
  draft: Draft;
  projectId: string;
  hypothesis: string | null;
  item?: DraftAnalysis;
  close: () => void;
  save: (value: Input) => Promise<boolean>;
}) {
  const [value, setValue] = useState<Input>(
    () =>
      item ?? {
        hypothesis,
        method: null,
        variables: draft.hypotheses.find((h) => h.id === hypothesis)?.dependent ?? [],
        conditions: [],
        parameters: {},
        assumptions: [],
        alpha: 0.05,
        correction: 'none',
        missingPolicy: 'listwise',
      },
  );
  const [alpha, setAlpha] = useState(String(value.alpha));
  const [assumptions, setAssumptions] = useState(value.assumptions.join('\n'));
  const [attempted, setAttempted] = useState(false);
  const validAlpha =
    alpha.trim() !== '' && Number.isFinite(Number(alpha)) && Number(alpha) > 0 && Number(alpha) < 1;
  const move = (index: number, delta: number) => {
    const next = [...value.conditions];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setValue({ ...value, conditions: next });
  };
  return (
    <Dialog
      title={item ? 'Sửa phân tích' : 'Thêm phân tích'}
      description="Khai báo phép phân tích."
      onClose={close}
    >
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          setAttempted(true);
          if (!validAlpha) return;
          void save({
            ...value,
            alpha: Number(alpha),
            assumptions: assumptions
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean),
          }).then((ok) => {
            if (ok) close();
          });
        }}
      >
        <Select
          label="Phương pháp"
          value={value.method ?? ''}
          onChange={(e) => setValue({ ...value, method: (e.target.value || null) as Input['method'] })}
        >
          <option value="">Chưa chọn phương pháp</option>
          <optgroup label="SRD hỗ trợ ngay">
            {SRD_P0_METHODS.map((m) => (
              <option key={m} value={m}>
                {capitaliseFirst(methodWords(m))}
              </option>
            ))}
          </optgroup>
          <optgroup label="SRD chưa hỗ trợ">
            {SRD_P1_METHODS.map((m) => (
              <option key={m} value={m}>
                {capitaliseFirst(methodWords(m))}
              </option>
            ))}
          </optgroup>
        </Select>
        {value.method && <p className={styles.quiet}>{methodHint(value.method)}</p>}
        <div>
          Biến
          {draft.variables.map((v) => (
            <Checkbox
              key={v.id}
              checked={value.variables.includes(v.id)}
              onChange={(e) =>
                setValue({
                  ...value,
                  variables: e.target.checked
                    ? [...value.variables, v.id]
                    : value.variables.filter((id) => id !== v.id),
                })
              }
            >
              {v.id} {v.name}
            </Checkbox>
          ))}
          {!draft.variables.length && (
            <p className={styles.quiet}>
              Chưa có biến nào.{' '}
              <Link to={`/p/${encodeURIComponent(projectId)}/measurement?tab=variables`}>
                Thêm biến ở màn Đo lường.
              </Link>
            </p>
          )}
        </div>
        <div>
          Điều kiện so sánh
          {value.method && TWO_SAMPLE.includes(value.method) && (
            <p className={styles.quiet}>Phương pháp này so sánh đúng hai điều kiện.</p>
          )}
          {value.conditions.map((id, i) => (
            <div className={styles.actions} key={id}>
              <span>
                {id} {draft.conditions.find((c) => c.id === id)?.name}
              </span>
              <Button variant="ghost" disabled={i === 0} onClick={() => move(i, -1)}>
                Lên
              </Button>
              <Button variant="ghost" disabled={i === value.conditions.length - 1} onClick={() => move(i, 1)}>
                Xuống
              </Button>
              <Button
                variant="ghost"
                onClick={() => setValue({ ...value, conditions: value.conditions.filter((c) => c !== id) })}
              >
                Gỡ
              </Button>
            </div>
          ))}
          <Select
            label="Thêm điều kiện"
            value=""
            onChange={(e) => {
              if (e.target.value) setValue({ ...value, conditions: [...value.conditions, e.target.value] });
            }}
          >
            <option value="">Chọn điều kiện</option>
            {draft.conditions
              .filter((c) => !value.conditions.includes(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} {c.name}
                </option>
              ))}
          </Select>
        </div>
        <TextField
          label="α"
          value={alpha}
          onChange={(e) => setAlpha(e.target.value)}
          error={attempted && !validAlpha ? 'α phải là số lớn hơn 0 và nhỏ hơn 1.' : undefined}
        />
        <Select
          label="Hiệu chỉnh đa so sánh"
          value={value.correction}
          onChange={(e) => setValue({ ...value, correction: e.target.value as Input['correction'] })}
        >
          {(['none', 'bonferroni', 'holm', 'fdr_bh'] as const).map((v) => (
            <option key={v} value={v}>
              {correctionWords(v)}
            </option>
          ))}
        </Select>
        <Select
          label="Dữ liệu thiếu"
          value={value.missingPolicy}
          onChange={(e) => setValue({ ...value, missingPolicy: e.target.value as Input['missingPolicy'] })}
        >
          {(['listwise', 'pairwise', 'fail'] as const).map((v) => (
            <option key={v} value={v}>
              {missingPolicyWords(v)}
            </option>
          ))}
        </Select>
        <TextField
          label="Giả định"
          multiline
          hint="Mỗi dòng một giả định."
          value={assumptions}
          onChange={(e) => setAssumptions(e.target.value)}
        />
        <div>
          Tham số
          <ParamsEditor
            value={value.parameters}
            onChange={(parameters) => setValue({ ...value, parameters })}
          />
        </div>
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
