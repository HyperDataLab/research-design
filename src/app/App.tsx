import { AuthProvider } from '@/shared/auth/AuthProvider';
import { ApiProvider } from '@/shared/api/ApiProvider';
import { AccountButton } from './AccountButton';
import ProjectHome from '@/modules/projects/ProjectHome';
import ProjectLayout from '@/modules/projects/ProjectLayout';
import { Menu, Monitor, Moon, Sun } from 'lucide-react';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Drawer } from '@/shared/ui/Drawer';
import { IconButton } from '@/shared/ui/IconButton';
import { ToastProvider } from '@/shared/ui/ToastProvider';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Empty } from '@/shared/ui/StateNote';
import { modules } from './modules';
import { Sidebar } from './Sidebar';
import styles from './shell.module.css';
type Theme = 'light' | 'dark' | 'system';
const THEME_LABELS: Record<Theme, string> = { system: 'theo hệ thống', light: 'sáng', dark: 'tối' };
const NEXT_THEME: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
function readTheme(): Theme {
  try {
    const value = localStorage.getItem('theme');
    if (value === 'light' || value === 'dark') return value;
  } catch {
    /* Storage may be unavailable. */
  }
  return 'system';
}
export function App() {
  const [drawer, setDrawer] = useState(false);
  const [projectTitle, setProjectTitle] = useState<{ id: string; title: string } | null>(null);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const location = useLocation();
  const current = modules.find((item) =>
    item.scope === 'project'
      ? location.pathname.endsWith(`/${item.id}`)
      : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`),
  );
  const projectHome = location.pathname.match(/^\/p\/([^/]+)\/?$/);
  const title = projectHome
    ? projectTitle?.id === decodeURIComponent(projectHome[1]!)
      ? projectTitle.title
      : 'Dự án'
    : (current?.label ?? 'Không tìm thấy');
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* Storage may be unavailable. */
    }
  }, [theme]);
  return (
    <AuthProvider>
      <ApiProvider>
        <ToastProvider>
          <div className={styles.shell}>
            <div className={styles.desktopSidebar}>
              <Sidebar />
            </div>
            <Drawer open={drawer} onClose={closeDrawer}>
              <Sidebar onNavigate={closeDrawer} />
            </Drawer>
            <div className={styles.main}>
              <header className={styles.topbar}>
                <div className={styles.mobileMenu}>
                  <IconButton label="Mở menu" onClick={() => setDrawer(true)}>
                    <Menu size={20} />
                  </IconButton>
                </div>
                <span className={styles.mobileTitle} aria-hidden="true">
                  {title}
                </span>
                <div className={styles.topActions}>
                  <AccountButton />
                  <IconButton
                    variant="ghost"
                    label={`Giao diện ${THEME_LABELS[theme]}. Bấm để đổi`}
                    onClick={() => setTheme(NEXT_THEME[theme])}
                  >
                    {theme === 'dark' ? (
                      <Moon size={18} />
                    ) : theme === 'light' ? (
                      <Sun size={18} />
                    ) : (
                      <Monitor size={18} />
                    )}
                  </IconButton>
                </div>
              </header>
              <main className={styles.content}>
                <Suspense fallback={<Skeleton />}>
                  <Routes>
                    <Route path="/p/:projectId" element={<ProjectLayout onProject={setProjectTitle} />}>
                      <Route index element={<ProjectHome />} />
                      {modules
                        .filter((item) => item.scope === 'project')
                        .map((item) => (
                          <Route key={item.id} path={item.path} element={<item.page />} />
                        ))}
                    </Route>
                    {modules
                      .filter((item) => item.scope !== 'project')
                      .map((item) => (
                        <Route key={item.id} path={item.path} element={<item.page />} />
                      ))}
                    <Route
                      path="*"
                      element={
                        <Empty
                          title="Không tìm thấy trang"
                          hint="Đường dẫn này không tồn tại. Chọn một màn hình ở thanh bên."
                        >
                          <Link to="/">Về Tổng quan</Link>
                        </Empty>
                      }
                    />
                  </Routes>
                </Suspense>
              </main>
            </div>
          </div>
        </ToastProvider>
      </ApiProvider>
    </AuthProvider>
  );
}
