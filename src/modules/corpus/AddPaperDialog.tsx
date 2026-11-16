import { useState } from 'react';
import type { PaperInput } from '@/core/papers/papers';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { TextField } from '@/shared/ui/TextField';
import styles from './Page.module.css';

export function AddPaperDialog({
  close,
  add,
}: {
  close: () => void;
  add: (input: PaperInput) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [title, setTitle] = useState('');
  const [doi, setDoi] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState('');
  const [venue, setVenue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const n = year.trim() ? Number(year) : null;
    if (n !== null && (!Number.isInteger(n) || n < 1500 || n > 2100)) {
      setError('invalid_year');
      return;
    }
    setBusy(true);
    const result = await add({
      title,
      doi: doi || null,
      authors: authors
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
      year: n,
      venue: venue.trim() || null,
    });
    setBusy(false);
    if (result.ok) close();
    else setError(result.error ?? 'network');
  };
  return (
    <Dialog title="Thêm bài báo" description="Nhập thông tin bài báo." onClose={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className={styles.form}
      >
        <TextField
          label="DOI"
          value={doi}
          onChange={(e) => setDoi(e.target.value)}
          error={
            error === 'duplicate_doi'
              ? 'Bài báo có DOI này đã có trong dự án.'
              : error === 'invalid_doi'
                ? 'DOI không hợp lệ.'
                : undefined
          }
        />
        <TextField
          label="Tên bài"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={error === 'invalid_title' ? 'Tên bài phải có từ 1 đến 500 ký tự.' : undefined}
        />
        <TextField
          label="Tác giả"
          hint="Các tác giả cách nhau bằng dấu phẩy."
          value={authors}
          onChange={(e) => setAuthors(e.target.value)}
        />
        <TextField
          label="Năm"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          error={error === 'invalid_year' ? 'Năm phải từ 1500 đến 2100.' : undefined}
        />
        <TextField label="Nơi đăng" value={venue} onChange={(e) => setVenue(e.target.value)} />
        {error === 'network' && <p>Không lưu được bài báo. Vui lòng thử lại.</p>}
        <div className={styles.actions}>
          <Button onClick={close}>Hủy</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            Lưu
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
