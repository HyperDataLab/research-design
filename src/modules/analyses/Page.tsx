import { useState } from 'react';
import { Link } from 'react-router-dom';
import { checkPlan } from '@/core/draft/checkPlan';
import { addAnalysis, editAnalysis, removeAnalysis } from '@/core/draft/planOps';
import type { DraftAnalysis, DraftHypothesis } from '@/core/draft/schema';
import { ChainLine } from '@/shared/draft/ChainLine';
import {
  capitaliseFirst,
  correctionWords,
  methodWords,
  missingPolicyWords,
  planFlagText,
} from '@/shared/draft/planText';
import { useDraft } from '@/shared/draft/useDraft';
import { useProject } from '@/shared/project/projectContext';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Dialog } from '@/shared/ui/Dialog';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Empty, Loading } from '@/shared/ui/StateNote';
import { useToast } from '@/shared/ui/toastContext';
import { AnalysisDialog } from './AnalysisDialog';
import styles from './Page.module.css';

export default function Page() {
  const { project, readOnly } = useProject();
  const state = useDraft();
  const { draft } = state;
  const toast = useToast();
  const [editor, setEditor] = useState<{ hypothesis: string | null; item?: DraftAnalysis } | null>(null);
  const [deleting, setDeleting] = useState<DraftAnalysis | null>(null);
  const flags = checkPlan(draft);
  const save = async (value: Omit<DraftAnalysis, 'id'>) => {
    const result = await state.change((d) =>
      editor?.item ? editAnalysis(d, editor.item.id, value) : addAnalysis(d, value),
    );
    if (!result.ok)
      toast(
        result.error === 'network'
          ? 'Không lưu được. Kiểm tra kết nối rồi thử lại.'
          : 'Không thể lưu thay đổi. Dữ liệu có thể đã thay đổi.',
      );
    return result.ok;
  };
  const card = (hypothesis: DraftHypothesis | null) => {
    const entries = draft.analyses.filter((a) =>
      hypothesis ? a.hypothesis === hypothesis.id : !draft.hypotheses.some((h) => h.id === a.hypothesis),
    );
    return (
      <Card key={hypothesis?.id ?? 'unattached'}>
        <div className={styles.stack}>
          <h2>
            {hypothesis ? (
              <>
                <span className={styles.mono}>{hypothesis.id}</span>{' '}
                <span className={styles.reading}>{hypothesis.statement}</span>
              </>
            ) : (
              'Không gắn giả thuyết'
            )}
          </h2>
          {hypothesis && <ChainLine draft={draft} hypothesisId={hypothesis.id} projectId={project.id} />}
          {entries.map((a) => (
            <div className={styles.row} key={a.id}>
              <p>
                <span className={styles.mono}>{a.id}</span>{' '}
                {a.method ? capitaliseFirst(methodWords(a.method)) : 'Chưa chọn phương pháp'}{' '}
                {flags.some((f) => f.rule === 'AN-07' && f.subject === a.id) && (
                  <Badge tone="warning">SRD chưa hỗ trợ</Badge>
                )}
              </p>
              <p className={styles.quiet}>
                Biến:{' '}
                {a.variables
                  .map((id) => `${id} ${draft.variables.find((v) => v.id === id)?.name ?? ''}`.trim())
                  .join(', ') || 'chưa chọn'}
              </p>
              <p className={styles.quiet}>
                So sánh:{' '}
                {a.conditions
                  .map((id) => `${id} ${draft.conditions.find((c) => c.id === id)?.name ?? ''}`.trim())
                  .join(' → ') || 'chưa chọn'}
              </p>
              <p className={styles.quiet}>
                α = {a.alpha} · hiệu chỉnh: {correctionWords(a.correction)} · thiếu dữ liệu:{' '}
                {missingPolicyWords(a.missingPolicy)}
              </p>
              {Object.keys(a.parameters).length > 0 && (
                <p className={styles.mono}>
                  {Object.entries(a.parameters)
                    .map(([k, v]) => `${k} = ${String(v)}`)
                    .join(' · ')}
                </p>
              )}
              {a.assumptions.length > 0 && (
                <ul>
                  {a.assumptions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
              {flags
                .filter((f) => f.subject === a.id)
                .map((f, i) => (
                  <p key={i} className={f.level === 'note' ? styles.quiet : undefined}>
                    {f.level === 'warning' && <Badge tone="warning">Cần xem lại</Badge>}{' '}
                    {planFlagText(f, draft)}
                  </p>
                ))}
              {!readOnly && (
                <div className={styles.actions}>
                  <Button variant="ghost" onClick={() => setEditor({ hypothesis: a.hypothesis, item: a })}>
                    Sửa
                  </Button>
                  <Button variant="ghost" onClick={() => setDeleting(a)}>
                    Xoá
                  </Button>
                </div>
              )}
            </div>
          ))}
          {!readOnly && (
            <div>
              <Button variant="ghost" onClick={() => setEditor({ hypothesis: hypothesis?.id ?? null })}>
                Thêm phân tích
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  };
  return (
    <>
      <PageHeader title="Phân tích thống kê" lead="Khai báo trước phép kiểm định cho từng giả thuyết." />
      {readOnly && <Badge>Đã lưu trữ · chỉ đọc</Badge>}
      {state.loading ? (
        <Loading />
      ) : state.error ? (
        <Empty title="Không tải được phân tích thống kê.">
          <Button onClick={() => void state.reload()}>Thử lại</Button>
        </Empty>
      ) : (
        <div className={styles.stack}>
          {!draft.hypotheses.length && (
            <Empty title="Chưa có giả thuyết nào.">
              <Link to={`/p/${encodeURIComponent(project.id)}/questions`}>
                Thêm giả thuyết ở màn Câu hỏi và giả thuyết.
              </Link>
            </Empty>
          )}
          {[...draft.hypotheses].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true })).map(card)}
          {card(null)}
        </div>
      )}
      {editor && (
        <AnalysisDialog
          draft={draft}
          projectId={project.id}
          hypothesis={editor.hypothesis}
          item={editor.item}
          close={() => setEditor(null)}
          save={save}
        />
      )}
      {deleting && (
        <Dialog title="Xoá phân tích" description={`Xoá ${deleting.id}?`} onClose={() => setDeleting(null)}>
          <Button onClick={() => setDeleting(null)}>Hủy</Button>
          <Button
            variant="danger"
            onClick={() => {
              void state
                .change((d) => removeAnalysis(d, deleting.id))
                .then((result) => {
                  if (result.ok) setDeleting(null);
                  else toast('Không thể xoá phân tích. Dữ liệu có thể đã thay đổi.');
                });
            }}
          >
            Xoá
          </Button>
        </Dialog>
      )}
    </>
  );
}
