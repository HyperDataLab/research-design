import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { IconButton } from './IconButton';
import styles from './ui.module.css';
export function Drawer({
  open,
  onClose,
  children,
  label = 'Điều hướng',
  side = 'left',
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label?: string;
  side?: 'left' | 'right';
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = ref.current;
    const focusable = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    // Focus the panel itself, so it opens at its top and Tab reaches the close button first. Focusing the
    // first link inside would scroll the panel down to wherever that link happens to sit.
    panel?.focus({ preventScroll: true });
    panel?.querySelector<HTMLElement>('[data-drawer-body]')?.scrollTo?.({ top: 0 });
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'Tab') {
        const items = focusable();
        if (!items.length) {
          event.preventDefault();
          panel?.focus();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first || !panel?.contains(document.activeElement))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || !panel?.contains(document.activeElement))
        ) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`${styles.drawer} ${side === 'right' ? styles.drawerRight : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        <div className={styles.drawerClose} data-drawer-close="">
          <IconButton variant="ghost" size="sm" label="Đóng" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </IconButton>
        </div>
        <div className={styles.drawerBody} data-drawer-body="">
          {children}
        </div>
      </div>
    </div>
  );
}
