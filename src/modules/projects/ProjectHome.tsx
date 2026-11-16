import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Project } from '@/core/project/schema';
import { modules } from '@/app/modules';
import { GROUPS } from '@/app/groups';
import { StageList } from '@/shared/workflow/StageList';
import { PageHeader } from '@/shared/ui/PageHeader';
import styles from '@/modules/home/home.module.css';
import { useApi } from '@/shared/api/apiContext';
import { ApiError } from '@/shared/api/client';
import { useAuth } from '@/shared/auth/authContext';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Empty, Loading } from '@/shared/ui/StateNote';
export default function ProjectHome() {
  const { projectId = '' } = useParams();
  const api = useApi();
  const { user, ready, signIn, mode } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user) return;
    let active = true;
    void api.getProject(projectId).then(
      (p) => {
        if (!active) return;
        setProject(p);
        setError('');
        try {
          localStorage.setItem('last-project', p.id);
        } catch {
          /* Storage is optional. */
        }
      },
      (cause: unknown) => {
        if (active) {
          setProject(null);
          setError(cause instanceof ApiError && cause.status === 404 ? 'missing' : 'error');
        }
      },
    );
    return () => {
      active = false;
    };
  }, [api, projectId, user]);
  if (!ready) return <Loading />;
  if (!user)
    return (
      <Empty title="Đăng nhập để xem dự án" hint="Đăng nhập để mở dự án.">
        {mode !== 'unconfigured' && <Button onClick={() => void signIn()}>Đăng nhập</Button>}
      </Empty>
    );
  if (error)
    return (
      <Empty title={error === 'missing' ? 'Không tìm thấy dự án' : 'Không tải được dự án'}>
        <Link to="/projects">Về Dự án</Link>
      </Empty>
    );
  if (!project || project.id !== projectId) return <Loading />;
  return (
    <>
      <PageHeader title={project.title} lead="Các bước của dự án." />
      {project.archived && <Badge>Đã lưu trữ</Badge>}
      <StageList groups={GROUPS} modules={modules} styles={styles} />
    </>
  );
}
