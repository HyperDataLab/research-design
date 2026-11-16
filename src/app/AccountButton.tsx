import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/shared/auth/authContext';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import styles from './AccountButton.module.css';
export function AccountButton() {
  const { mode, user, ready, error, signIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('click', onClick);
    };
  }, [open]);
  if (!ready) return null;
  return (
    <div className={styles.wrapper} ref={wrapper}>
      {error && <span role="alert">{error} </span>}
      {mode === 'unconfigured' ? (
        <span>Chưa cấu hình đăng nhập</span>
      ) : !user ? (
        <Button size="sm" onClick={() => void signIn()}>
          {import.meta.env.DEV && mode === 'dev' ? 'Đăng nhập (dev)' : 'Đăng nhập'}
        </Button>
      ) : (
        <>
          {import.meta.env.DEV && mode === 'dev' && <Badge tone="warning">Chế độ phát triển</Badge>}
          <Button variant="ghost" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
            {user.name || user.email}
          </Button>
          {open && (
            <div className={styles.menu} role="menu">
              <span className={styles.email}>{user.email}</span>
              <Button
                variant="ghost"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
              >
                Đăng xuất
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
