import { useState } from 'react';
import { findClaimType, findDesign, findThreat } from '@/core/bank/readSnapshot';
import { checkDesign, type DesignFlag } from '@/core/draft/checkDesign';
import {
  addThreat,
  editThreat,
  removeThreat,
  setAssignment,
  setDesign,
  type DraftResult,
} from '@/core/draft/ops';
import type { Draft, DraftThreat } from '@/core/draft/schema';
import { useBank } from '@/shared/bank/useBank';
import { flagText } from '@/shared/draft/flagText';
import { useDraft } from '@/shared/draft/useDraft';
import { useProject } from '@/shared/project/projectContext';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Dialog } from '@/shared/ui/Dialog';
import { PageHeader } from '@/shared/ui/PageHeader';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { Empty, Loading } from '@/shared/ui/StateNote';
import { useToast } from '@/shared/ui/toastContext';
import { DesignDrawer } from './DesignDrawer';
import { ThreatDialog } from './ThreatDialog';
import { assignments, word } from './words';
import styles from './Page.module.css';

export default function Page() {
  const { project, readOnly } = useProject();
  const draftState = useDraft();
  const bankState = useBank();
  const { draft } = draftState;
  const { bank } = bankState;
  const toast = useToast();
  const [drawer, setDrawer] = useState(false);
  const [editing, setEditing] = useState<DraftThreat | 'new' | null>(null);
  const [deleting, setDeleting] = useState<DraftThreat | null>(null);
  const change = async (fn: (d: Draft) => DraftResult) => {
    const result = await draftState.change(fn);
    if (!result.ok) toast('Không thể lưu thay đổi. Vui lòng thử lại.');
    return result.ok;
  };
  const flags = checkDesign(draft, bank);
  const design = draft.design?.bank && findDesign(bank, draft.design.bank.id);
  const warning = (flag: DesignFlag) => (
    <p className={styles.warning} key={`${flag.rule}-${flag.subject}`}>
      <Badge tone="warning">Cần xem lại</Badge>{' '}
      {flag.rule === 'DS-05' && flag.reason === 'missing' && 'Không còn trong bản chụp hiện tại. '}
      {flagText(flag, draft, bank)}
    </p>
  );
  return (
    <>
      <PageHeader
        title="Thiết kế nghiên cứu"
        lead="Chọn thiết kế, xem nó cho phép kết luận gì, ghi mối đe doạ và cách giảm."
      />
      {readOnly && <Badge>Đã lưu trữ · chỉ đọc</Badge>}
      {draftState.loading || bankState.loading ? (
        <Loading />
      ) : draftState.error || bankState.error ? (
        <Empty title="Không tải được thiết kế.">
          <Button
            onClick={() => {
              void draftState.reload();
              void bankState.reload();
            }}
          >
            Thử lại
          </Button>
        </Empty>
      ) : (
        <div className={styles.stack}>
          <Card>
            <h2>Thiết kế</h2>
            {!draft.design ? (
              <Empty title="Chưa chọn thiết kế" hint={readOnly ? undefined : 'Chọn một thiết kế để bắt đầu.'}>
                {!readOnly && (
                  <Button variant="primary" onClick={() => setDrawer(true)}>
                    Chọn thiết kế
                  </Button>
                )}
              </Empty>
            ) : (
              <>
                <p className={styles.reading}>{draft.design.name}</p>
                {design?.status === 'draft' && <Badge>Bản nháp của bank</Badge>}
                {flags.filter((f) => f.rule === 'DS-05' && f.subject === 'design').map(warning)}
                <p>Cách phân nhóm</p>
                {readOnly ? (
                  <p>{draft.design.assignment ? word('assignment', draft.design.assignment) : 'Chưa chọn'}</p>
                ) : (
                  <fieldset className={styles.fixed} disabled={!!design && design.assignment !== 'either'}>
                    <SegmentedControl
                      label="Cách phân nhóm"
                      value={draft.design.assignment ?? ''}
                      options={assignments}
                      onChange={(v) => {
                        void change((d) => setAssignment(d, v as NonNullable<Draft['design']>['assignment']));
                      }}
                    />
                  </fieldset>
                )}
                {design && design.assignment !== 'either' && (
                  <p className={styles.quiet}>Writing Bank quy định cách phân nhóm của thiết kế này.</p>
                )}
                {flags.filter((f) => f.rule === 'DS-03').map(warning)}
                {!readOnly && (
                  <Button variant="ghost" onClick={() => setDrawer(true)}>
                    Đổi thiết kế
                  </Button>
                )}
              </>
            )}
          </Card>
          <Card>
            <h2>Thiết kế này cho phép kết luận gì</h2>
            {!draft.design ? (
              <p className={styles.quiet}>Chưa chọn thiết kế.</p>
            ) : !draft.design.bank ? (
              <p className={styles.quiet}>
                Thiết kế tự mô tả không có thông tin từ Writing Bank, nên không kiểm tra được giả thuyết.
              </p>
            ) : design ? (
              <>
                <p>Khả năng kết luận nhân quả: {word('causalLicence', design.causalLicence)}</p>
                <h3>Hỗ trợ</h3>
                <ul>
                  {design.supports.map((id) => (
                    <li key={id}>
                      {findClaimType(bank, id)?.name ?? id}
                      {findClaimType(bank, id)?.status === 'draft' && (
                        <>
                          {' '}
                          <Badge>Bản nháp của bank</Badge>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
                <h3>Không hỗ trợ</h3>
                <ul>
                  {design.cannotSupport.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
                <h3>Giả thuyết cần xem lại</h3>
                {flags.some((f) => f.rule === 'DS-01') ? (
                  flags
                    .filter((f) => f.rule === 'DS-01')
                    .map((f) => (
                      <div key={f.subject}>
                        <a href={`/p/${project.id}/questions`}>{f.subject}</a>
                        {warning(f)}
                      </div>
                    ))
                ) : (
                  <p>Không có giả thuyết nào cần xem lại.</p>
                )}
              </>
            ) : (
              <p className={styles.quiet}>Không có thông tin thiết kế trong bản chụp hiện tại.</p>
            )}
          </Card>
          <Card>
            <h2>Mối đe doạ</h2>
            {draft.threats.length === 0 && (
              <p className={styles.quiet}>Chưa có mối đe doạ trong danh sách.</p>
            )}
            {draft.threats.map((t) => (
              <div className={styles.row} key={t.id}>
                <span className={styles.mono}>{t.id}</span> <span className={styles.reading}>{t.name}</span>
                {t.bank && findThreat(bank, t.bank.id)?.status === 'draft' && (
                  <Badge>Bản nháp của bank</Badge>
                )}
                {t.mitigation ? (
                  <p>Cách giảm trong nghiên cứu này: {t.mitigation}</p>
                ) : (
                  <p className={styles.warning}>
                    <Badge tone="warning">Cần xem lại</Badge> Chưa ghi cách giảm
                  </p>
                )}
                {flags.filter((f) => f.rule === 'DS-05' && f.subject === t.id).map(warning)}
                {!readOnly && (
                  <div className={styles.actions}>
                    <Button variant="ghost" onClick={() => setEditing(t)}>
                      Sửa
                    </Button>
                    <Button variant="ghost" onClick={() => setDeleting(t)}>
                      Xoá
                    </Button>
                  </div>
                )}
              </div>
            ))}
            <h3>Gợi ý từ thiết kế</h3>
            {design?.threats
              .map((id) => findThreat(bank, id))
              .filter((t) => t && !draft.threats.some((x) => x.bank?.id === t.id))
              .map(
                (t) =>
                  t && (
                    <div className={styles.row} key={t.id}>
                      <strong>{t.name}</strong> {t.status === 'draft' && <Badge>Bản nháp của bank</Badge>}
                      <p>
                        {word('validity', t.type)} · {t.mechanism}
                      </p>
                      <p className={styles.quiet}>Gợi ý chung của bank: {t.mitigation}</p>
                      {!readOnly && bank && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            void change((d) =>
                              addThreat(d, {
                                name: t.name,
                                mitigation: '',
                                bank: { id: t.id, release: bank.release },
                              }),
                            );
                          }}
                        >
                          Thêm vào danh sách
                        </Button>
                      )}
                    </div>
                  ),
              )}
            {!readOnly && <Button onClick={() => setEditing('new')}>Thêm mối đe doạ</Button>}
          </Card>
        </div>
      )}
      {drawer && (
        <DesignDrawer
          bank={bank}
          projectId={project.id}
          onClose={() => setDrawer(false)}
          choose={(value) => {
            void change((d) => setDesign(d, value)).then((ok) => {
              if (ok) setDrawer(false);
            });
          }}
        />
      )}
      {editing && (
        <ThreatDialog
          threat={editing === 'new' ? null : editing}
          close={() => setEditing(null)}
          save={(name, mitigation) => {
            void change((d) =>
              editing === 'new'
                ? addThreat(d, { name, mitigation, bank: null })
                : editThreat(d, editing.id, { name, mitigation }),
            ).then((ok) => {
              if (ok) setEditing(null);
            });
          }}
        />
      )}
      {deleting && (
        <Dialog
          title="Xoá mối đe doạ"
          description={`Xoá «${deleting.name}» khỏi danh sách?`}
          onClose={() => setDeleting(null)}
        >
          <Button onClick={() => setDeleting(null)}>Hủy</Button>
          <Button
            variant="danger"
            onClick={() => {
              void change((d) => removeThreat(d, deleting.id)).then((ok) => {
                if (ok) setDeleting(null);
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
