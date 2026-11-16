import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import type { Project } from '@/core/project/schema';
import { useApi } from '@/shared/api/apiContext';
import { ApiError } from '@/shared/api/client';
import { useAuth } from '@/shared/auth/authContext';
import { Button } from '@/shared/ui/Button';
import { Empty, Loading } from '@/shared/ui/StateNote';
import { ProjectContext } from '@/shared/project/projectContext';
export default function ProjectLayout() {
  const location = useLocation();
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
    <ProjectContext.Provider value={{ project, readOnly: project.archived }}>
      {location.pathname.replace(/\/$/, '') !== `/p/${projectId}` && (
        <Link to={`/p/${projectId}`}>‹ {project.title}</Link>
      )}
      <Outlet />
    </ProjectContext.Provider>
  );
}
