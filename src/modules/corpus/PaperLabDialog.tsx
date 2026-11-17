import { useEffect, useState } from 'react';
import type { PaperLabPaper, createPaperLabClient } from '@/shared/paperlab/client';
import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';

const labels = { none: 'Chưa có dữ kiện', candidate: 'Dữ kiện chưa duyệt', reviewed: 'Dữ kiện đã duyệt' };
export function PaperLabDialog({
  client,
  close,
  select,
}: {
  client: ReturnType<typeof createPaperLabClient>;
  close: () => void;
  select: (id: string) => Promise<void>;
}) {
  const [papers, setPapers] = useState<PaperLabPaper[] | null>(null);
  const [error, setError] = useState<'auth' | 'other' | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void client
      .listPapers()
      .then((items) => {
        if (active) setPapers(items);
      })
      .catch((e: unknown) => {
        if (active)
          setError(e instanceof ApiError && (e.status === 401 || e.status === 403) ? 'auth' : 'other');
      });
    return () => {
      active = false;
    };
  }, [client]);
  return (
    <Dialog title="Thêm từ PaperLab" description="Chọn trong các bài PaperLab đã công bố." onClose={close}>
      {error ? (
        <p>
          {error === 'auth'
            ? 'PaperLab chưa chấp nhận tài khoản của ứng dụng này.'
            : 'Không tải được danh sách PaperLab.'}
        </p>
      ) : papers === null ? (
        <p>Đang tải…</p>
      ) : papers.length === 0 ? (
        <p>PaperLab chưa công bố bài báo nào.</p>
      ) : (
        <ul>
          {papers.map((paper) => (
            <li key={paper.paperId}>
              <div>{paper.title}</div>
              <div>{paper.doi}</div>
              <div>
                {paper.publishedBy} · {labels[paper.experimentFacts]}
              </div>
              <Button
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void select(paper.paperId).finally(() => setBusy(false));
                }}
              >
                Chọn
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
