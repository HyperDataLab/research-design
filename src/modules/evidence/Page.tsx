import { useState } from 'react';
import { Link } from 'react-router-dom';
import { findBenchmark, findMetric } from '@/core/bank/readSnapshot';
import { usage } from '@/core/facts/usage';
import { useBank } from '@/shared/bank/useBank';
import { Card } from '@/shared/ui/Card';
import { comparisonRows, staleModel } from '@/core/facts/view';
import { useProject } from '@/shared/project/projectContext';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Chip } from '@/shared/ui/Chip';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Empty, Loading } from '@/shared/ui/StateNote';
import { TextField } from '@/shared/ui/TextField';
import { useToast } from '@/shared/ui/toastContext';
import { FactDrawer } from './FactDrawer';
import { useEvidence, type Selection } from './useEvidence';
import styles from './Page.module.css';

const labels = ['Task', 'Dataset', 'Baseline', 'Phương pháp', 'Metric', 'Thiết kế', 'Mẫu', 'Kết quả'];
export default function Page() {
  const { project, readOnly } = useProject();
  const { bank } = useBank();
  const state = useEvidence(bank);
  const toast = useToast();
  const [opened, setOpened] = useState<Selection | null>(null);
  const [selected, setSelected] = useState<Selection[]>([]);
  const [excluding, setExcluding] = useState(false);
  const [reason, setReason] = useState('');
  const corpus = `/p/${encodeURIComponent(project.id)}/corpus`;
  const run = async (entries: Selection[], action: 'use' | 'exclude' | 'clear', input: string | null) => {
    const result = await state.change(entries, action, input);
    if (result.ok) {
      setSelected([]);
      setExcluding(false);
      return;
    }
    toast(
      result.error === 'not_anchored'
        ? 'Có dữ kiện không tìm thấy neo trong paper model đang giữ nên chưa thể dùng.'
        : result.error === 'reason_required'
          ? 'Cần ghi lý do khi loại.'
          : result.error === 'conflict'
            ? 'Dữ kiện vừa được người khác thay đổi; hãy thử lại.'
            : 'Không lưu được. Kiểm tra kết nối rồi thử lại.',
    );
  };
  const docs = Object.fromEntries(Object.entries(state.items).map(([id, item]) => [id, item.doc]));
  const rows = comparisonRows(state.papers, docs);
  const counts = usage(state.papers, docs, bank);
  const paper = state.papers.find((entry) => entry.id === opened?.paperId);
  const doc = opened && state.items[opened.paperId]?.doc;
  const fact = doc?.facts.facts.find((entry) => entry.id === opened?.factId);
  return (
    <>
      <PageHeader title="Bảng so sánh" lead="So sánh dữ kiện từ các bài báo đã chọn." />
      {readOnly && <Badge>Đã lưu trữ · chỉ đọc</Badge>}
      {state.loading ? (
        <Loading />
      ) : state.error ? (
        <Empty title="Không tải được bảng so sánh.">
          <Button onClick={() => void state.reload()}>Thử lại</Button>
        </Empty>
      ) : !rows.length ? (
        <Empty title="Chưa có bài báo nào được chọn">
          <Link to={corpus}>Tập bài báo</Link>
        </Empty>
      ) : (
        <div className={styles.stack}>
          {!readOnly && selected.length > 0 && (
            <div className={styles.actions}>
              <span>Đã chọn {selected.length}</span>
              <Button onClick={() => void run(selected, 'use', null)}>Dùng</Button>
              <Button variant="secondary" onClick={() => setExcluding(true)}>
                Loại
              </Button>
              {excluding && (
                <>
                  <TextField
                    label="Lý do loại"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <Button variant="secondary" onClick={() => void run(selected, 'exclude', reason)}>
                    Xác nhận loại
                  </Button>
                </>
              )}
            </div>
          )}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Bài báo</th>
                  {labels.map((label, index) => (
                    <th key={label}>
                      {label}
                      {[0, 5, 6].includes(index) && (
                        <div className={styles.quiet}>PaperLab chưa cung cấp</div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.paper.id}>
                    <th scope="row">
                      {row.paper.title}
                      {state.items[row.paper.id] &&
                        staleModel(
                          state.items[row.paper.id]!.doc,
                          row.paper.model?.paperlab?.etag ?? null,
                        ) && <p>Dữ kiện thuộc paper model cũ hơn bản dự án đang giữ.</p>}
                    </th>
                    {!state.items[row.paper.id]?.doc.facts.facts.length ? (
                      <td colSpan={8} className={styles.quiet}>
                        Chưa có dữ kiện từ PaperLab · <Link to={corpus}>Tập bài báo</Link>
                      </td>
                    ) : (
                      row.cells.map((cell) => (
                        <td key={cell.kind}>
                          {!cell.items.length
                            ? 'Không có'
                            : cell.items.map(({ fact: entry, decision, status }) => {
                                const selection = { paperId: row.paper.id, factId: entry.id };
                                return (
                                  <div key={entry.id} className={styles.actions}>
                                    {!readOnly && (
                                      <Checkbox
                                        aria-label={`Chọn ${entry.value}`}
                                        checked={selected.some(
                                          (s) =>
                                            s.paperId === selection.paperId && s.factId === selection.factId,
                                        )}
                                        onChange={(event) =>
                                          setSelected((current) =>
                                            event.target.checked
                                              ? [...current, selection]
                                              : current.filter(
                                                  (s) =>
                                                    s.paperId !== selection.paperId ||
                                                    s.factId !== selection.factId,
                                                ),
                                          )
                                        }
                                      >
                                        {''}
                                      </Checkbox>
                                    )}
                                    <Chip
                                      onClick={() => {
                                        setOpened(selection);
                                        void state
                                          .loadModel(row.paper.id)
                                          .catch(() =>
                                            toast('Không tải được. Kiểm tra kết nối rồi thử lại.'),
                                          );
                                      }}
                                    >
                                      {entry.value}{' '}
                                      {decision && (
                                        <Badge>{decision.decision === 'use' ? 'Dùng' : 'Loại'}</Badge>
                                      )}{' '}
                                      {status === 'candidate' && <Badge>Chưa duyệt</Badge>}
                                    </Chip>
                                  </div>
                                );
                              })}
                        </td>
                      ))
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Card>
            <div className={styles.stack}>
              <h2>Dùng trong nhiều bài</h2>
              {Object.values(counts).every((list) => list.length === 0) ? (
                <p className={styles.quiet}>Chưa có dữ kiện nào được đặt Dùng</p>
              ) : (
                (['baseline', 'dataset', 'metric'] as const).map((kind) => (
                  <div key={kind}>
                    <h3>{kind === 'baseline' ? 'Baseline' : kind === 'dataset' ? 'Dataset' : 'Metric'}</h3>
                    <ul>
                      {counts[kind].map((row) => (
                        <li key={row.key}>
                          {row.label}{' '}
                          {row.bankId &&
                            (findMetric(bank, row.bankId) ?? findBenchmark(bank, row.bankId))?.status ===
                              'draft' && <Badge>Bản nháp</Badge>}{' '}
                          · <span className={styles.mono}>{row.papers.length} bài</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
      {opened && paper && doc && fact && (
        <FactDrawer
          key={`${opened.paperId}:${opened.factId}`}
          paper={paper}
          doc={doc}
          fact={fact}
          model={state.models[paper.id]}
          projectId={project.id}
          readOnly={readOnly}
          bank={bank}
          match={(id) =>
            void state.match(opened.paperId, opened.factId, id).then((result) => {
              if (!result.ok)
                toast(
                  result.error === 'conflict'
                    ? 'Dữ kiện vừa được người khác thay đổi; hãy thử lại.'
                    : 'Không lưu được. Kiểm tra kết nối rồi thử lại.',
                );
            })
          }
          close={() => setOpened(null)}
          change={(action, input) => void run([opened], action, input)}
        />
      )}
    </>
  );
}
