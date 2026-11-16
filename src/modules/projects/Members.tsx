import { useState } from 'react';
import { checkMemberEmail, sortMembers } from '@/core/project/members';
import { useApi } from '@/shared/api/apiContext';
import { ApiError } from '@/shared/api/client';
import { useAuth } from '@/shared/auth/authContext';
import { allowedDomain } from '@/shared/auth/config';
import { useProject } from '@/shared/project/projectContext';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Dialog } from '@/shared/ui/Dialog';
import { TextField } from '@/shared/ui/TextField';
import { useToast } from '@/shared/ui/toastContext';
import styles from './Members.module.css';

const errors = {
  malformed: 'Email không hợp lệ.',
  foreign_domain: 'Email không thuộc tổ chức.',
  already_member: 'Email đã là thành viên.',
  too_many: 'Dự án có tối đa 50 thành viên.',
};

export default function Members() {
  const { project, readOnly, setProject } = useProject();
  const { user } = useAuth();
  const api = useApi();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const owner = user?.email.toLowerCase() === project.owner.toLowerCase();

  async function change(action: 'add' | 'remove', member: string) {
    setBusy(true);
    try {
      const current = await api.getProject(project.id);
      setProject?.(current);
      if (current.archived || current.owner.toLowerCase() !== user?.email.toLowerCase()) {
        toast('Dự án đã thay đổi. Danh sách đã được tải lại.');
        return;
      }
      if (action === 'add') {
        const result = checkMemberEmail(member, current.members, allowedDomain);
        if (!result.ok) {
          setError(errors[result.error]);
          return;
        }
      } else if (!current.members.includes(member)) {
        toast('Thành viên đã được gỡ. Danh sách đã được tải lại.');
        return;
      }
      const members =
        action === 'add' ? [...current.members, member] : current.members.filter((m) => m !== member);
      setProject?.(await api.patchProject(project.id, { members }));
      setEmail('');
      setError('');
      setRemoving(null);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        try {
          setProject?.(await api.getProject(project.id));
          toast('Dự án đã thay đổi. Danh sách đã được tải lại.');
        } catch {
          toast('Không lưu được. Kiểm tra kết nối rồi thử lại.');
        }
      } else {
        toast(
          cause instanceof ApiError && cause.status === 403
            ? 'Chỉ chủ dự án thêm hoặc gỡ thành viên.'
            : cause instanceof ApiError && cause.status === 400
              ? 'Email không hợp lệ hoặc không thuộc tổ chức.'
              : 'Không lưu được. Kiểm tra kết nối rồi thử lại.',
        );
      }
    } finally {
      setBusy(false);
    }
  }
  function add() {
    const result = checkMemberEmail(email, project.members, allowedDomain);
    if (!result.ok) {
      setError(errors[result.error]);
      return;
    }
    setError('');
    void change('add', result.email);
  }
  return (
    <div className={styles.card}>
      <Card>
        <h2>Thành viên</h2>
        {sortMembers(project.members, project.owner).map((member) => (
          <div className={styles.row} key={member}>
            <span className={styles.email}>
              {member} {member === project.owner && <span className={styles.quiet}>Chủ dự án</span>}
            </span>
            {!readOnly && owner && member !== project.owner && (
              <Button variant="ghost" disabled={busy} onClick={() => setRemoving(member)}>
                Gỡ
              </Button>
            )}
          </div>
        ))}
        {!readOnly &&
          (owner ? (
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                add();
              }}
              noValidate
            >
              <TextField
                label="Email thành viên"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError('');
                }}
                error={error}
              />
              <Button type="submit" disabled={busy}>
                Thêm
              </Button>
            </form>
          ) : (
            <p className={styles.quiet}>Chỉ chủ dự án thêm hoặc gỡ thành viên.</p>
          ))}
      </Card>
      {removing && (
        <Dialog
          title={`Gỡ ${removing} khỏi dự án?`}
          description="Người này sẽ không còn thấy dự án."
          onClose={() => setRemoving(null)}
        >
          <div className={styles.actions}>
            <Button disabled={busy} onClick={() => setRemoving(null)}>
              Hủy
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => void change('remove', removing)}>
              Gỡ
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
