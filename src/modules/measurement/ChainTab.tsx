import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Draft, DraftHypothesis } from '@/core/draft/schema';
import { setHypothesisVariables } from '@/core/draft/measureOps';
import type { DraftResult } from '@/core/draft/ops';
import { checkChain } from '@/core/draft/checkChain';
import { ChainLine } from '@/shared/draft/ChainLine';
import { chainFlagText } from '@/shared/draft/chainText';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Dialog } from '@/shared/ui/Dialog';
import { Empty } from '@/shared/ui/StateNote';
import styles from './Page.module.css';

export function ChainTab({
  draft,
  projectId,
  readOnly,
  change,
}: {
  draft: Draft;
  projectId: string;
  readOnly: boolean;
  change: (fn: (d: Draft) => DraftResult) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<DraftHypothesis | null>(null);
  const [selected, setSelected] = useState<{ independent: string[]; dependent: string[] }>({
    independent: [],
    dependent: [],
  });
  return (
    <>
      {!draft.hypotheses.length && (
        <Empty title="Chưa có giả thuyết nào.">
          <Link to={`/p/${projectId}/questions`}>Câu hỏi và giả thuyết</Link>
        </Empty>
      )}
      {!!draft.hypotheses.length && !draft.variables.length && (
        <p className={styles.quiet}>Chưa có biến nào. Thêm biến ở tab Biến.</p>
      )}
      {draft.hypotheses.map((h) => (
        <div className={styles.row} key={h.id}>
          <ChainLine draft={draft} hypothesisId={h.id} projectId={projectId} />
          {checkChain(draft)
            .filter(
              (f) =>
                f.subject === h.id &&
                f.rule !== 'CH-01' &&
                !(f.rule === 'CH-03' && f.which === 'missing' && h.dependent.includes(f.variable)),
            )
            .map((f, i) => (
              <p key={i}>
                <Badge tone="warning">Cần xem lại</Badge> {chainFlagText(f, draft)}
              </p>
            ))}
          {!readOnly && (
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(h);
                setSelected({ independent: h.independent, dependent: h.dependent });
              }}
            >
              Gắn biến
            </Button>
          )}
        </div>
      ))}
      {editing && (
        <Dialog title="Gắn biến" description="Chọn các biến của giả thuyết." onClose={() => setEditing(null)}>
          {(['independent', 'dependent'] as const).map((role) => (
            <div key={role}>
              <h3>{role === 'independent' ? 'Biến độc lập' : 'Biến phụ thuộc'}</h3>
              {draft.variables
                .filter((v) => v.role === role)
                .map((v) => (
                  <Checkbox
                    key={v.id}
                    checked={selected[role].includes(v.id)}
                    onChange={(e) =>
                      setSelected({
                        ...selected,
                        [role]: e.target.checked
                          ? [...selected[role], v.id]
                          : selected[role].filter((id) => id !== v.id),
                      })
                    }
                  >
                    {v.id} {v.name}
                  </Checkbox>
                ))}
            </div>
          ))}
          <Button onClick={() => setEditing(null)}>Hủy</Button>
          <Button
            variant="primary"
            onClick={() => {
              void change((d) => setHypothesisVariables(d, editing.id, selected)).then((ok) => {
                if (ok) setEditing(null);
              });
            }}
          >
            Lưu
          </Button>
        </Dialog>
      )}
    </>
  );
}
