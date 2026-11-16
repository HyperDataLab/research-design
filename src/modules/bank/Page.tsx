import { useRef, useState } from 'react';
import { useApi } from '@/shared/api/apiContext';
import { draftSchema, emptyDraft } from '@/core/draft/schema';
import { useBank } from '@/shared/bank/useBank';
import { useDraft } from '@/shared/draft/useDraft';
import { useProject } from '@/shared/project/projectContext';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Dialog } from '@/shared/ui/Dialog';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Empty, Loading } from '@/shared/ui/StateNote';
import { useToast } from '@/shared/ui/toastContext';
import styles from './Page.module.css';

const reasons: Record<string, string> = {
  too_large: 'Tệp vượt quá giới hạn 2 MiB.',
  not_json: 'Tệp không phải JSON.',
  not_a_snapshot: 'Tệp không phải bản chụp Writing Bank.',
  unsupported_version: 'Phiên bản bản chụp không được hỗ trợ.',
  invalid: 'Bản chụp không hợp lệ.',
  conflict: 'Bản chụp đã thay đổi; vui lòng thử lại.',
  network: 'Không thể nhập bản chụp. Vui lòng thử lại.',
};
export default function Page() {
  const { readOnly, project } = useProject();
  const client = useApi();
  const bank = useBank();
  const draft = useDraft();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<((answer: boolean) => void) | null>(null);
  const [refusal, setRefusal] = useState<{ error: string; issues?: string[] } | null>(null);
  const choose = () => input.current?.click();
  const importFile = async (file: File) => {
    const result = await bank.importSnapshot(file, async () => {
      if (!bank.bank) return true;
      let needsConfirmation = true;
      try {
        const stored = await client.getDoc(project.id, 'draft');
        const current = draftSchema.parse(stored?.data ?? emptyDraft());
        needsConfirmation = !!current.design?.bank || current.threats.some((t) => !!t.bank);
      } catch {
        // An unreadable draft may contain references, so require confirmation.
      }
      return needsConfirmation ? new Promise<boolean>((resolve) => setConfirm(() => resolve)) : true;
    });
    if (result.ok) {
      setRefusal(null);
      toast('Đã nhập bản chụp Writing Bank.');
    } else if (result.error !== 'cancelled')
      setRefusal({ error: result.error, issues: 'issues' in result ? result.issues : undefined });
  };
  return (
    <>
      <PageHeader title="Writing Bank" lead="Bản chụp thiết kế, mối đe doạ và loại nhận định của dự án." />
      {readOnly && <Badge>Đã lưu trữ · chỉ đọc</Badge>}
      {refusal && (
        <div role="alert">
          <p>{reasons[refusal.error]}</p>
          {refusal.issues && (
            <ul>
              {refusal.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {bank.loading || draft.loading ? (
        <Loading />
      ) : bank.error ? (
        <Empty title="Không tải được bản chụp.">
          <Button
            onClick={() => {
              void bank.reload();
              void draft.reload();
            }}
          >
            Thử lại
          </Button>
        </Empty>
      ) : (
        <Card>
          {!bank.bank ? (
            <Empty
              title="Chưa có bản chụp"
              hint="Thiết kế, mối đe doạ và loại nhận định đến từ bản chụp Writing Bank."
            >
              {!readOnly && (
                <Button variant="primary" onClick={choose}>
                  Nhập bản chụp
                </Button>
              )}
            </Empty>
          ) : (
            <>
              <p className={styles.release}>{bank.bank.release}</p>
              <p>Nguồn: {bank.bank.source}</p>
              <p>
                Người nhập: {bank.bank.importedBy} · {new Date(bank.bank.importedAt).toLocaleString('vi-VN')}
              </p>
              <p>
                {bank.bank.collections.designs.length} thiết kế, {bank.bank.collections.threats.length} mối đe
                doạ, {bank.bank.collections['claim-types'].length} loại nhận định,{' '}
                {bank.bank.collections.metrics.length} metric, {bank.bank.collections.protocols.length}{' '}
                protocol, {bank.bank.collections.benchmarks.length} benchmark.
              </p>
              {!readOnly && <Button onClick={choose}>Thay bản chụp</Button>}
            </>
          )}
        </Card>
      )}
      {!readOnly && (
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void importFile(file);
          }}
        />
      )}
      {confirm && (
        <Dialog
          title="Thay bản chụp"
          description="Bản nháp đang tham chiếu bản chụp hiện tại. Thay bản chụp?"
          onClose={() => {
            confirm(false);
            setConfirm(null);
          }}
        >
          <Button
            onClick={() => {
              confirm(false);
              setConfirm(null);
            }}
          >
            Hủy
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              confirm(true);
              setConfirm(null);
            }}
          >
            Thay bản chụp
          </Button>
        </Dialog>
      )}
    </>
  );
}
