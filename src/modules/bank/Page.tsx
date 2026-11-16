import { useRef, useState } from 'react';
import { useApi } from '@/shared/api/apiContext';
import { ApiError } from '@/shared/api/client';
import { useAuth } from '@/shared/auth/authContext';
import { bankUrl } from '@/shared/auth/config';
import { createBankClient } from '@/shared/bank/bankApi';
import { draftSchema, emptyDraft } from '@/core/draft/schema';
import { bankRefs } from '@/core/draft/bankRefs';
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
  hash_mismatch: 'Tệp không khớp mã băm nội dung mà nó tự khai; hãy tải lại bản phát hành từ Writing Bank.',
  conflict: 'Bản chụp đã thay đổi; vui lòng thử lại.',
  network: 'Không thể nhập bản chụp. Vui lòng thử lại.',
  bank_auth: 'Writing Bank chưa chấp nhận tài khoản của ứng dụng này.',
  rate_limit: 'Writing Bank đang giới hạn số lần gọi; thử lại sau.',
};
export default function Page() {
  const { readOnly, project } = useProject();
  const client = useApi();
  const { getIdToken } = useAuth();
  const bank = useBank();
  const draft = useDraft();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<((answer: boolean) => void) | null>(null);
  const [refusal, setRefusal] = useState<{ error: string; issues?: string[] } | null>(null);
  const [releaseMessage, setReleaseMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const choose = () => input.current?.click();
  const beforeWrite = async () => {
    if (!bank.bank) return true;
    let needsConfirmation = true;
    try {
      const stored = await client.getDoc(project.id, 'draft');
      const current = draftSchema.parse(stored?.data ?? emptyDraft());
      needsConfirmation = bankRefs(current).length > 0;
    } catch {
      // An unreadable draft may contain references, so require confirmation.
    }
    return needsConfirmation ? new Promise<boolean>((resolve) => setConfirm(() => resolve)) : true;
  };
  const finish = (result: { ok: true } | { ok: false; error: string; issues?: string[] }) => {
    if (result.ok) {
      setRefusal(null);
      toast('Đã nhập bản chụp Writing Bank.');
    } else if (result.error !== 'cancelled')
      setRefusal({ error: result.error, issues: 'issues' in result ? result.issues : undefined });
  };
  const importFile = async (file: File) => finish(await bank.importSnapshot(file, beforeWrite));
  const checkRelease = async () => {
    setBusy(true);
    setRefusal(null);
    setReleaseMessage('');
    try {
      const latest = await createBankClient({ baseUrl: bankUrl, getToken: getIdToken }).getRelease();
      setReleaseMessage(
        latest.release === bank.bank?.release
          ? `Dự án đang dùng bản mới nhất (${latest.release}).`
          : `Writing Bank có bản ${latest.release}, phát hành ${latest.date}.`,
      );
    } catch (e) {
      setRefusal({
        error:
          e instanceof ApiError && (e.status === 401 || e.status === 403)
            ? 'bank_auth'
            : e instanceof ApiError && e.status === 429
              ? 'rate_limit'
              : 'network',
      });
    } finally {
      setBusy(false);
    }
  };
  const fetchLatest = async () => {
    setBusy(true);
    setRefusal(null);
    const api = createBankClient({ baseUrl: bankUrl, getToken: getIdToken });
    try {
      finish(await bank.fetchSnapshot(api.getSnapshot, beforeWrite));
    } finally {
      setBusy(false);
    }
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
              {bank.bank.releaseDate && <p>Ngày phát hành: {bank.bank.releaseDate}</p>}
              {bank.bank.includesDrafts && (
                <p>
                  <Badge tone="warning">Có mục bản nháp</Badge> Bản phát hành này gồm cả các mục Writing Bank
                  chưa xuất bản.
                </p>
              )}
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
          {bankUrl && (
            <>
              <Button disabled={busy} onClick={() => void checkRelease()}>
                Kiểm tra bản mới
              </Button>
              {!readOnly && (
                <Button disabled={busy} onClick={() => void fetchLatest()}>
                  Lấy bản mới
                </Button>
              )}
              {releaseMessage && <p>{releaseMessage}</p>}
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
