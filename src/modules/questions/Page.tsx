import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { checkDesign } from '@/core/draft/checkDesign';
import {
  addHypothesis,
  addQuestion,
  editHypothesis,
  editQuestion,
  removeHypothesis,
  removeQuestion,
  type DraftError,
  type DraftResult,
} from '@/core/draft/ops';
import type { Draft, DraftHypothesis, DraftQuestion } from '@/core/draft/schema';
import { emptyPapersDoc, papersDocSchema, type Paper } from '@/core/papers/papers';
import { useApi } from '@/shared/api/apiContext';
import { useBank } from '@/shared/bank/useBank';
import { flagText } from '@/shared/draft/flagText';
import { useDraft } from '@/shared/draft/useDraft';
import { useProject } from '@/shared/project/projectContext';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Dialog } from '@/shared/ui/Dialog';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Empty, Loading } from '@/shared/ui/StateNote';
import { useToast } from '@/shared/ui/toastContext';
import { HypothesisEditor, QuestionEditor } from './Editors';
import { claimLabel, kinds } from './view';
import styles from './Page.module.css';

const errors: Record<DraftError | 'network', string> = {
  invalid_text: 'Vui lòng nhập nội dung.',
  unknown_question: 'Câu hỏi không còn tồn tại.',
  unknown_hypothesis: 'Giả thuyết không còn tồn tại.',
  unknown_threat: 'Mối đe doạ không còn tồn tại.',
  has_hypotheses: 'Câu hỏi vẫn còn giả thuyết.',
  duplicate_threat: 'Mối đe doạ đã tồn tại.',
  no_design: 'Chưa chọn thiết kế.',
  network: 'Không lưu được. Kiểm tra kết nối rồi thử lại.',
};
type Editor =
  | { type: 'question'; item?: DraftQuestion }
  | { type: 'hypothesis'; item?: DraftHypothesis; question: string | null };
type Deletion = { type: 'question' | 'hypothesis'; id: string };

export default function Page() {
  const { project, readOnly } = useProject();
  const client = useApi();
  const draft = useDraft();
  const bank = useBank();
  const toast = useToast();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deletion, setDeletion] = useState<Deletion | null>(null);
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const stored = await client.getDoc(project.id, 'papers');
      setPapers(papersDocSchema.parse(stored?.data ?? emptyPapersDoc()).papers);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [client, project.id]);
  useEffect(() => {
    void Promise.resolve().then(reload);
  }, [reload]);
  const change = async (fn: (value: Draft) => DraftResult) => {
    const result = await draft.change(fn);
    if (!result.ok) toast(errors[result.error]);
    return result.ok;
  };
  const flags = checkDesign(draft.draft, bank.bank);
  const count =
    deletion?.type === 'question'
      ? draft.draft.hypotheses.filter((h) => h.question === deletion.id).length
      : 0;
  const rows = (hypotheses: DraftHypothesis[]) =>
    hypotheses.map((h) => (
      <div className={styles.row} key={h.id}>
        <span className={styles.mono}>{h.id}</span> <span className={styles.reading}>{h.statement}</span>{' '}
        <Badge>{kinds[h.kind]}</Badge>
        <p className={styles.quiet}>{claimLabel(h.claim, bank.bank?.collections['claim-types'] ?? [])}</p>
        {flags
          .filter((f) => f.subject === h.id)
          .map((f, i) => (
            <p key={`${f.rule}-${i}`}>
              <Badge tone="warning">Cần xem lại</Badge> {flagText(f, draft.draft, bank.bank)}
            </p>
          ))}
        {!readOnly && (
          <div className={styles.actions}>
            <Button
              variant="ghost"
              onClick={() => setEditor({ type: 'hypothesis', item: h, question: h.question })}
            >
              Sửa
            </Button>
            <Button variant="ghost" onClick={() => setDeletion({ type: 'hypothesis', id: h.id })}>
              Xoá
            </Button>
          </div>
        )}
      </div>
    ));
  const unattached = draft.draft.hypotheses.filter(
    (h) => !h.question || !draft.draft.questions.some((q) => q.id === h.question),
  );
  return (
    <>
      <PageHeader
        title="Câu hỏi và giả thuyết"
        lead="Câu hỏi nghiên cứu và giả thuyết có mã ổn định, nối với khoảng trống tìm được."
      >
        {!readOnly &&
          !loading &&
          !draft.loading &&
          !bank.loading &&
          !error &&
          !draft.error &&
          !bank.error && (
            <Button variant="primary" onClick={() => setEditor({ type: 'question' })}>
              Thêm câu hỏi
            </Button>
          )}
      </PageHeader>
      {readOnly && <Badge>Đã lưu trữ · chỉ đọc</Badge>}
      {loading || draft.loading || bank.loading ? (
        <Loading />
      ) : error || draft.error || bank.error ? (
        <Empty title="Không tải được câu hỏi và giả thuyết.">
          <Button
            onClick={() => {
              void reload();
              void draft.reload();
              void bank.reload();
            }}
          >
            Thử lại
          </Button>
        </Empty>
      ) : (
        <div className={styles.stack}>
          {draft.draft.questions.length === 0 && (
            <Empty title="Chưa có câu hỏi nào." hint="Bắt đầu bằng câu hỏi mà nghiên cứu này trả lời." />
          )}
          {[...draft.draft.questions]
            .sort((a, b) => Number(a.id.slice(2)) - Number(b.id.slice(2)))
            .map((q) => (
              <Card key={q.id}>
                <p>
                  <span className={styles.mono}>{q.id}</span> <span className={styles.reading}>{q.text}</span>
                </p>
                <p>
                  Khoảng trống:{' '}
                  <span className={q.gap ? styles.reading : styles.quiet}>
                    {q.gap || 'Chưa ghi khoảng trống'}
                  </span>
                </p>
                {q.papers.map((id) => (
                  <p key={id}>
                    <Link to={`/p/${project.id}/corpus`}>
                      {papers.find((p) => p.id === id)?.title ?? 'Bài báo không còn trong dự án'}
                    </Link>
                  </p>
                ))}
                {!readOnly && (
                  <div className={styles.actions}>
                    <Button variant="ghost" onClick={() => setEditor({ type: 'question', item: q })}>
                      Sửa
                    </Button>
                    <Button variant="ghost" onClick={() => setDeletion({ type: 'question', id: q.id })}>
                      Xoá
                    </Button>
                    <Button variant="ghost" onClick={() => setEditor({ type: 'hypothesis', question: q.id })}>
                      Thêm giả thuyết
                    </Button>
                  </div>
                )}
                {rows(draft.draft.hypotheses.filter((h) => h.question === q.id))}
              </Card>
            ))}
          {unattached.length > 0 && (
            <Card>
              <h2>Chưa gắn câu hỏi</h2>
              {rows(unattached)}
            </Card>
          )}
        </div>
      )}
      {editor?.type === 'question' && (
        <QuestionEditor
          initial={editor.item}
          papers={papers}
          close={() => setEditor(null)}
          save={(value) =>
            change((d) => (editor.item ? editQuestion(d, editor.item.id, value) : addQuestion(d, value)))
          }
        />
      )}
      {editor?.type === 'hypothesis' && (
        <HypothesisEditor
          initial={editor.item}
          question={editor.question}
          draft={draft.draft}
          bank={bank.bank}
          projectId={project.id}
          close={() => setEditor(null)}
          save={(value) =>
            change((d) => (editor.item ? editHypothesis(d, editor.item.id, value) : addHypothesis(d, value)))
          }
        />
      )}
      {deletion && (
        <Dialog
          title={deletion.type === 'question' ? 'Xoá câu hỏi' : 'Xoá giả thuyết'}
          description="Xác nhận thao tác xoá."
          onClose={() => setDeletion(null)}
        >
          <p>
            {count
              ? `Câu hỏi này còn ${count} giả thuyết. Chuyển hoặc xoá các giả thuyết trước.`
              : 'Bạn có chắc muốn xoá?'}
          </p>
          <div className={styles.actions}>
            <Button onClick={() => setDeletion(null)}>Hủy</Button>
            {!count && (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void change((d) =>
                    deletion.type === 'question'
                      ? removeQuestion(d, deletion.id)
                      : removeHypothesis(d, deletion.id),
                  ).then((ok) => {
                    setBusy(false);
                    if (ok) setDeletion(null);
                  });
                }}
              >
                Xoá
              </Button>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}
