import { useState } from 'react';
import { checkPlan } from '@/core/draft/checkPlan';
import { gridCells, setRunMatrix } from '@/core/draft/planOps';
import { runCount, type DraftRunMatrix } from '@/core/draft/schema';
import { planFlagText } from '@/shared/draft/planText';
import { useDraft } from '@/shared/draft/useDraft';
import { useProject } from '@/shared/project/projectContext';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Empty, Loading } from '@/shared/ui/StateNote';
import { useToast } from '@/shared/ui/toastContext';
import { GridForm } from './GridForm';
import styles from './Page.module.css';

export default function Page() {
  const { project, readOnly } = useProject();
  const state = useDraft();
  const toast = useToast();
  const [formVersion, setFormVersion] = useState(0);
  const { draft } = state;
  const matrix = draft.runMatrix;
  const count = runCount(matrix);
  const preview = gridCells(draft, 20);
  const flags = checkPlan(draft).filter((f) => f.subject === 'runMatrix' || f.rule === 'AN-05');
  const save = async (value: DraftRunMatrix) => {
    const result = await state.change((current) => setRunMatrix(current, value));
    if ('doc' in result) setFormVersion((version) => version + 1);
    if (!result.ok) {
      toast(
        result.error === 'network'
          ? 'Không lưu được. Kiểm tra kết nối rồi thử lại.'
          : 'Lưới chạy đã thay đổi và không thể lưu. Vui lòng kiểm tra lại.',
      );
      return false;
    }
    toast('Đã lưu lưới chạy.');
    return true;
  };
  return (
    <>
      <PageHeader title="Ma trận chạy" lead="Điều kiện × dataset × seed, tên experiment và tag MLflow." />
      {readOnly && <Badge>Đã lưu trữ · chỉ đọc</Badge>}
      {state.loading ? (
        <Loading />
      ) : state.error ? (
        <Empty title="Không tải được ma trận chạy.">
          <Button onClick={() => void state.reload()}>Thử lại</Button>
        </Empty>
      ) : (
        <div className={styles.stack}>
          <Card>
            <h2>Lưới chạy</h2>
            <GridForm
              key={formVersion}
              draft={draft}
              projectId={project.id}
              readOnly={readOnly}
              save={save}
            />
          </Card>
          <Card>
            <h2>Số lần chạy</h2>
            <p className={styles.reading}>
              {count
                ? `${matrix.conditions.length} điều kiện × ${matrix.datasets.length} dataset × ${matrix.seeds.length} seed = ${count} lần chạy`
                : 'Chưa đủ để tính số lần chạy.'}
            </p>
            {flags.map((flag, i) => (
              <p key={i}>
                <Badge tone="warning">Cần xem lại</Badge> {planFlagText(flag, draft)}
              </p>
            ))}
          </Card>
          <Card>
            <h2>Các ô đầu tiên</h2>
            {preview.cells.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">
                        Điều kiện
                        <br />
                        <span className={styles.mono}>plan.condition_id</span>
                      </th>
                      <th scope="col">
                        Dataset
                        <br />
                        <span className={styles.mono}>plan.dataset_id</span>
                      </th>
                      <th scope="col">
                        Seed
                        <br />
                        <span className={styles.mono}>plan.seed</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.cells.map((cell) => (
                      <tr key={`${cell.condition}/${cell.dataset}/${cell.seed}`}>
                        <td className={styles.mono}>{cell.tags['plan.condition_id']}</td>
                        <td className={styles.mono}>{cell.tags['plan.dataset_id']}</td>
                        <td className={styles.mono}>{cell.tags['plan.seed']}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.quiet}>Chưa có ô nào trong lưới chạy đã lưu.</p>
            )}
            {preview.total > preview.cells.length && (
              <p className={styles.quiet}>… và {preview.total - preview.cells.length} ô nữa</p>
            )}
            <p className={styles.quiet}>
              <span className={styles.mono}>plan.id</span> và{' '}
              <span className={styles.mono}>plan.version</span> được gán khi đóng băng.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
