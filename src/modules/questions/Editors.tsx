import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { BankDoc } from '@/core/bank/snapshot';
import type { Draft, DraftHypothesis, DraftQuestion } from '@/core/draft/schema';
import type { Paper } from '@/core/papers/papers';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Dialog } from '@/shared/ui/Dialog';
import { Select } from '@/shared/ui/Select';
import { TextField } from '@/shared/ui/TextField';
import { kinds } from './view';
import styles from './Page.module.css';

export type QuestionInput = Omit<DraftQuestion, 'id'>;
export type HypothesisInput = Pick<DraftHypothesis, 'statement' | 'kind' | 'question' | 'claim'>;

export function QuestionEditor({
  initial,
  papers,
  close,
  save,
}: {
  initial?: DraftQuestion;
  papers: Paper[];
  close: () => void;
  save: (value: QuestionInput) => Promise<boolean>;
}) {
  const [text, setText] = useState(initial?.text ?? '');
  const [gap, setGap] = useState(initial?.gap ?? '');
  const [selected, setSelected] = useState(initial?.papers ?? []);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      title={initial ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}
      description="Ghi câu hỏi và khoảng trống nghiên cứu."
      onClose={close}
    >
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void save({ text, gap, papers: selected }).then((ok) => {
            setBusy(false);
            if (ok) close();
          });
        }}
      >
        <TextField label="Câu hỏi" required value={text} onChange={(e) => setText(e.target.value)} />
        <TextField label="Khoảng trống" multiline value={gap} onChange={(e) => setGap(e.target.value)} />
        {papers
          .filter((p) => p.decision === 'included')
          .map((p) => (
            <Checkbox
              key={p.id}
              checked={selected.includes(p.id)}
              onChange={(e) =>
                setSelected(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id))
              }
            >
              {p.title}
            </Checkbox>
          ))}
        <div className={styles.actions}>
          <Button onClick={close}>Hủy</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            Lưu
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function HypothesisEditor({
  initial,
  question,
  draft,
  bank,
  projectId,
  close,
  save,
}: {
  initial?: DraftHypothesis;
  question: string | null;
  draft: Draft;
  bank: BankDoc | null;
  projectId: string;
  close: () => void;
  save: (value: HypothesisInput) => Promise<boolean>;
}) {
  const [statement, setStatement] = useState(initial?.statement ?? '');
  const [kind, setKind] = useState<DraftHypothesis['kind']>(initial?.kind ?? 'directional');
  const [linked, setLinked] = useState(initial?.question ?? question ?? '');
  const [claim, setClaim] = useState(initial?.claim ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      title={initial ? 'Sửa giả thuyết' : 'Thêm giả thuyết'}
      description="Ghi phát biểu và các liên kết của giả thuyết."
      onClose={close}
    >
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void save({ statement, kind, question: linked || null, claim: claim || null }).then((ok) => {
            setBusy(false);
            if (ok) close();
          });
        }}
      >
        <TextField
          label="Phát biểu"
          required
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
        />
        <Select
          label="Dạng"
          value={kind}
          onChange={(e) => setKind(e.target.value as DraftHypothesis['kind'])}
        >
          {Object.entries(kinds).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>
        <Select label="Câu hỏi" value={linked} onChange={(e) => setLinked(e.target.value)}>
          <option value="">Chưa gắn câu hỏi</option>
          {draft.questions.map((q) => (
            <option key={q.id} value={q.id}>
              {q.id} · {q.text}
            </option>
          ))}
        </Select>
        {bank ? (
          <Select label="Loại nhận định" value={claim} onChange={(e) => setClaim(e.target.value)}>
            <option value="">Chưa phân loại</option>
            {claim && !bank.collections['claim-types'].some((c) => c.id === claim) && (
              <option value={claim}>{claim}</option>
            )}
            {bank.collections['claim-types'].map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.status === 'draft' ? ' · Bản nháp' : ''}
              </option>
            ))}
          </Select>
        ) : (
          <p className={styles.quiet}>
            Cần bản chụp Writing Bank để phân loại nhận định.{' '}
            <Link to={`/p/${projectId}/bank`}>Writing Bank</Link>
          </p>
        )}
        <div className={styles.actions}>
          <Button onClick={close}>Hủy</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            Lưu
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
