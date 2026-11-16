import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Project } from '@/core/project/schema';
import { useApi } from '@/shared/api/apiContext';
import { ApiError } from '@/shared/api/client';
import { useAuth } from '@/shared/auth/authContext';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Chip } from '@/shared/ui/Chip';
import { Dialog } from '@/shared/ui/Dialog';
import { TextField } from '@/shared/ui/TextField';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Empty, Loading } from '@/shared/ui/StateNote';
import { useToast } from '@/shared/ui/toastContext';
import styles from './Page.module.css';
export default function Page() {
  const { user, ready, signIn, mode } = useAuth();
  const api = useApi();
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [archived, setArchived] = useState(false);
  const [dialog, setDialog] = useState<Project | 'new' | null>(null);
  const [title, setTitle] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setProjects(await api.listProjects());
    } catch {
      setError('Không tải được dự án.');
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    if (user) void Promise.resolve().then(load);
  }, [user, load]);
  const open = (project: Project | 'new') => {
    setDialog(project);
    setTitle(project === 'new' ? '' : project.title);
    setDialogError('');
  };
  const conflict = async (cause: unknown) => {
    if (cause instanceof ApiError && (cause.status === 404 || cause.status === 409)) {
      await load();
      toast('Dự án đã thay đổi. Danh sách đã được tải lại.');
      return true;
    }
    return false;
  };
  const save = async () => {
    const value = title.trim();
    if (!value || value.length > 200) {
      setDialogError('Tên dự án phải có từ 1 đến 200 ký tự.');
      return;
    }
    setBusy(true);
    setDialogError('');
    try {
      if (dialog === 'new') await api.createProject(value);
      else if (dialog) await api.patchProject(dialog.id, { title: value });
      setDialog(null);
      await load();
    } catch (cause) {
      await conflict(cause);
      setDialogError('Không lưu được dự án. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (project: Project) => {
    try {
      await api.patchProject(project.id, { archived: !project.archived });
      if (project.archived && projects.filter((item) => item.archived).length === 1) setArchived(false);
      await load();
    } catch (cause) {
      if (!(await conflict(cause))) toast('Không cập nhật được dự án.');
    }
  };
  let last: string | null = null;
  try {
    last = localStorage.getItem('last-project');
  } catch {
    /* Storage is optional. */
  }
  const reopen = projects.find((p) => p.id === last);
  const count = projects.filter((p) => p.archived).length;
  const visible = projects.filter((p) => p.archived === archived);
  return (
    <>
      <PageHeader title="Dự án" lead="Tạo và quản lý các dự án nghiên cứu.">
        {user && (
          <Button variant="primary" onClick={() => open('new')}>
            Tạo dự án
          </Button>
        )}
      </PageHeader>
      {!ready ? (
        <Loading />
      ) : !user ? (
        <Empty title="Đăng nhập để xem dự án" hint="Đăng nhập để tạo và quản lý dự án.">
          {mode !== 'unconfigured' && <Button onClick={() => void signIn()}>Đăng nhập</Button>}
        </Empty>
      ) : loading ? (
        <Loading />
      ) : error ? (
        <Empty title={error}>
          <Button onClick={() => void load()}>Thử lại</Button>
        </Empty>
      ) : (
        <>
          {reopen && (
            <p>
              <Link to={'/p/' + reopen.id}>Mở lại: {reopen.title}</Link>
            </p>
          )}
          {count > 0 && (
            <Chip count={count} aria-pressed={archived} onClick={() => setArchived(!archived)}>
              Đã lưu trữ
            </Chip>
          )}
          {projects.length === 0 ? (
            <Empty title="Chưa có dự án nào" hint="Tạo dự án để bắt đầu." />
          ) : visible.length === 0 ? (
            <Empty
              title="Không có dự án đang hoạt động"
              hint="Các dự án đã lưu trữ nằm sau bộ lọc Đã lưu trữ."
            />
          ) : (
            <div className={styles.list}>
              {visible.map((p) => (
                <div className={styles.row} key={p.id}>
                  <Link className={styles.title} to={'/p/' + p.id}>
                    {p.title}
                  </Link>{' '}
                  {p.archived && <Badge>Đã lưu trữ</Badge>}
                  <div className={styles.meta}>
                    Chủ dự án: {p.owner === user.email ? 'bạn' : p.owner} · cập nhật{' '}
                    {new Date(p.updatedAt).toLocaleDateString('vi-VN')}
                  </div>
                  <div className={styles.actions}>
                    {!p.archived && (
                      <Button variant="ghost" onClick={() => open(p)}>
                        Đổi tên
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => void toggle(p)}>
                      {p.archived ? 'Khôi phục' : 'Lưu trữ'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {dialog && (
        <Dialog
          title={dialog === 'new' ? 'Tạo dự án' : 'Đổi tên dự án'}
          description="Nhập tên dự án."
          onClose={() => setDialog(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <TextField
              label="Tên dự án"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={dialogError}
            />
            <div className={styles.dialogActions}>
              <Button onClick={() => setDialog(null)}>Hủy</Button>
              <Button type="submit" variant="primary" disabled={busy}>
                Lưu
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
