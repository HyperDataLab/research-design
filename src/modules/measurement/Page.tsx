import { SuggestDrawer } from '@/shared/suggest/SuggestDrawer';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { checkChain } from '@/core/draft/checkChain';
import { checkDesign } from '@/core/draft/checkDesign';
import {
  addVariable,
  editVariable,
  removeVariable,
  addMetric,
  editMetric,
  removeMetric,
  addDataset,
  editDataset,
  removeDataset,
  addCondition,
  editCondition,
  removeCondition,
  users,
} from '@/core/draft/measureOps';
import { repin, type DraftResult } from '@/core/draft/ops';
import type { Draft, DraftVariable, DraftMetric, DraftDataset, DraftCondition } from '@/core/draft/schema';
import { useBank } from '@/shared/bank/useBank';
import { chainFlagText } from '@/shared/draft/chainText';
import { flagText } from '@/shared/draft/flagText';
import { RepinNotice } from '@/shared/draft/RepinNotice';
import { useDraft } from '@/shared/draft/useDraft';
import { useProject } from '@/shared/project/projectContext';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Empty, Loading } from '@/shared/ui/StateNote';
import { Tabs } from '@/shared/ui/Tabs';
import { useToast } from '@/shared/ui/toastContext';
import { ChainTab } from './ChainTab';
import { MetricDialog, type MetricInput } from './MetricDialog';
import { DatasetDialog, ConditionDialog } from './OtherDialogs';
import { Pickers } from './Pickers';
import { VariableDialog } from './VariableDialog';
import { VariablesTab } from './VariablesTab';
import { MetricsTab } from './MetricsTab';
import { DatasetsTab } from './DatasetsTab';
import { ConditionsTab } from './ConditionsTab';
import styles from './Page.module.css';

type Tab = 'chain' | 'variables' | 'metrics' | 'datasets' | 'conditions';
type Item = DraftVariable | DraftMetric | DraftDataset | DraftCondition;
function withoutId<T extends { id: string }>(item: T): Omit<T, 'id'> {
  const { id, ...value } = item;
  void id;
  return value;
}
const labels: Record<Tab, string> = {
  chain: 'Chuỗi',
  variables: 'Biến',
  metrics: 'Metric',
  datasets: 'Dataset',
  conditions: 'Điều kiện',
};
export default function Page() {
  const { project, readOnly } = useProject();
  const [suggestOpen, setSuggestOpen] = useState(false);
  const state = useDraft();
  const bankState = useBank();
  const toast = useToast();
  const draft = state.draft;
  const bank = bankState.bank;
  const [query, setQuery] = useSearchParams();
  const raw = query.get('tab') ?? 'chain';
  const tab: Tab = raw in labels ? (raw as Tab) : 'chain';
  const [picker, setPicker] = useState<'metrics' | 'datasets' | null>(null);
  const [editor, setEditor] = useState<{
    type: Exclude<Tab, 'chain'>;
    item?: Item;
    metric?: MetricInput;
    dataset?: Omit<DraftDataset, 'id'>;
  } | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const change = async (fn: (d: Draft) => DraftResult) => {
    const result = await state.change(fn);
    if (!result.ok)
      toast(
        (
          {
            invalid_text: 'Vui lòng nhập nội dung.',
            invalid_key: 'Key không hợp lệ.',
            invalid_hash: 'Mã SHA-256 không hợp lệ.',
            in_use: 'Mục này vẫn đang được sử dụng.',
            unknown_question: 'Câu hỏi không còn tồn tại.',
            unknown_hypothesis: 'Giả thuyết không còn tồn tại.',
            unknown_threat: 'Mối đe doạ không còn tồn tại.',
            has_hypotheses: 'Câu hỏi vẫn còn giả thuyết.',
            duplicate_threat: 'Mối đe doạ đã tồn tại.',
            no_design: 'Chưa chọn thiết kế.',
            unknown_variable: 'Biến không còn tồn tại.',
            unknown_metric: 'Metric không còn tồn tại.',
            unknown_dataset: 'Dataset không còn tồn tại.',
            unknown_condition: 'Điều kiện không còn tồn tại.',
            wrong_role: 'Biến không đúng vai trò.',
            network: 'Không lưu được. Kiểm tra kết nối rồi thử lại.',
          } as Record<string, string>
        )[result.error] ?? 'Không thể lưu thay đổi. Vui lòng thử lại.',
      );
    return result.ok;
  };
  const chainFlags = checkChain(draft);
  const designFlags = checkDesign(draft, bank);
  const counts = {
    chain: draft.hypotheses.length,
    variables: draft.variables.length,
    metrics: draft.metrics.length,
    datasets: draft.datasets.length,
    conditions: draft.conditions.length,
  };
  const rows: Item[] = tab === 'chain' ? [] : draft[tab];
  const remove = (d: Draft, id: string) =>
    tab === 'variables'
      ? removeVariable(d, id)
      : tab === 'metrics'
        ? removeMetric(d, id)
        : tab === 'datasets'
          ? removeDataset(d, id)
          : removeCondition(d, id);
  return (
    <>
      <PageHeader title="Đo lường" lead="Khái niệm, biến, metric, đơn vị, hướng tốt và quy trình đo." />
      {!readOnly && <Button onClick={() => setSuggestOpen(true)}>Gợi ý từ bảng so sánh</Button>}
      {suggestOpen && (
        <SuggestDrawer target="metrics" draft={draft} change={change} close={() => setSuggestOpen(false)} />
      )}
      {readOnly && <Badge>Đã lưu trữ · chỉ đọc</Badge>}
      {state.loading || bankState.loading ? (
        <Loading />
      ) : state.error || bankState.error ? (
        <Empty title="Không tải được đo lường.">
          <Button
            onClick={() => {
              void state.reload();
              void bankState.reload();
            }}
          >
            Thử lại
          </Button>
        </Empty>
      ) : (
        <div className={styles.stack}>
          <RepinNotice
            flags={designFlags}
            bank={bank}
            readOnly={readOnly}
            onRepin={(b) => {
              void change((d) => repin(d, b));
            }}
          />
          <Tabs label="Đo lường">
            {(Object.keys(labels) as Tab[]).map((t) => (
              <Button key={t} role="tab" aria-selected={tab === t} onClick={() => setQuery({ tab: t })}>
                {`${labels[t]} (${new Intl.NumberFormat('vi-VN').format(counts[t])})`}
              </Button>
            ))}
          </Tabs>
          {tab === 'chain' ? (
            <ChainTab draft={draft} projectId={project.id} readOnly={readOnly} change={change} />
          ) : (
            <>
              {!readOnly && (
                <div>
                  <Button
                    variant="primary"
                    onClick={() =>
                      tab === 'metrics' || tab === 'datasets' ? setPicker(tab) : setEditor({ type: tab })
                    }
                  >
                    Thêm {labels[tab].toLocaleLowerCase()}
                  </Button>
                </div>
              )}
              {!rows.length && <Empty title={`Chưa có ${labels[tab].toLocaleLowerCase()} nào.`} />}
              {tab === 'conditions' &&
                chainFlags
                  .filter((f) => f.subject === 'conditions')
                  .map((f) => (
                    <p key={f.rule}>
                      <Badge tone="warning">Cần xem lại</Badge> {chainFlagText(f, draft)}
                    </p>
                  ))}
              {rows.map((item) => (
                <div className={styles.row} key={item.id}>
                  <p>
                    <span className={styles.mono}>{item.id}</span> {item.name}{' '}
                    {'baseline' in item && item.baseline && <Badge>Baseline</Badge>}
                  </p>
                  {'role' in item && <VariablesTab item={item} draft={draft} />}
                  {'goal' in item && <MetricsTab item={item} bank={bank} />}
                  {'source' in item && <DatasetsTab item={item} bank={bank} />}
                  {'params' in item && <ConditionsTab item={item} />}
                  {chainFlags
                    .filter((f) => f.subject === item.id)
                    .map((f, i) => (
                      <p key={i}>
                        <Badge tone="warning">Cần xem lại</Badge> {chainFlagText(f, draft)}
                      </p>
                    ))}
                  {designFlags
                    .filter(
                      (f) => f.rule === 'DS-05' && f.reason !== 'other_release' && f.subject === item.id,
                    )
                    .map((f, i) => (
                      <p key={i}>
                        <Badge tone="warning">Cần xem lại</Badge> {flagText(f, draft, bank)}
                      </p>
                    ))}
                  {!readOnly && (
                    <div className={styles.actions}>
                      <Button variant="ghost" onClick={() => setEditor({ type: tab, item })}>
                        Sửa
                      </Button>
                      <Button variant="ghost" onClick={() => setDeleting(item)}>
                        Xoá
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
      {picker && (
        <Pickers
          kind={picker}
          bank={bank}
          projectId={project.id}
          close={() => setPicker(null)}
          metric={(metric) => {
            setPicker(null);
            setEditor({ type: 'metrics', metric });
          }}
          dataset={(dataset) => {
            setPicker(null);
            setEditor({ type: 'datasets', dataset });
          }}
        />
      )}
      {editor?.type === 'variables' && (
        <VariableDialog
          item={editor.item as DraftVariable | undefined}
          draft={draft}
          close={() => setEditor(null)}
          save={(v) => change((d) => (editor.item ? editVariable(d, editor.item.id, v) : addVariable(d, v)))}
        />
      )}
      {editor?.type === 'metrics' && (
        <MetricDialog
          initial={editor.item ? withoutId(editor.item as DraftMetric) : editor.metric!}
          bank={bank}
          close={() => setEditor(null)}
          save={(v) => change((d) => (editor.item ? editMetric(d, editor.item.id, v) : addMetric(d, v)))}
        />
      )}
      {editor?.type === 'datasets' && (
        <DatasetDialog
          initial={editor.item ? withoutId(editor.item as DraftDataset) : editor.dataset!}
          close={() => setEditor(null)}
          save={(v) => change((d) => (editor.item ? editDataset(d, editor.item.id, v) : addDataset(d, v)))}
        />
      )}
      {editor?.type === 'conditions' && (
        <ConditionDialog
          initial={editor.item as DraftCondition | undefined}
          close={() => setEditor(null)}
          save={(v) =>
            change((d) => (editor.item ? editCondition(d, editor.item.id, v) : addCondition(d, v)))
          }
        />
      )}
      {deleting && (
        <Dialog
          title={`Xoá ${labels[tab].toLocaleLowerCase()}`}
          description={
            users(draft, deleting.id).length
              ? `${deleting.id} đang được dùng bởi ${users(draft, deleting.id)
                  .map((id) => (id === 'runMatrix' ? 'lưới chạy' : id))
                  .join(', ')}. Gỡ liên kết trước khi xoá.`
              : `Xoá ${deleting.id} «${deleting.name}»?`
          }
          onClose={() => setDeleting(null)}
        >
          <Button onClick={() => setDeleting(null)}>Hủy</Button>
          {!users(draft, deleting.id).length && (
            <Button
              variant="danger"
              onClick={() => {
                void change((d) => remove(d, deleting.id)).then((ok) => {
                  if (ok) setDeleting(null);
                });
              }}
            >
              Xoá
            </Button>
          )}
        </Dialog>
      )}
    </>
  );
}
