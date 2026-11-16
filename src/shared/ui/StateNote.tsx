import type { ReactNode } from 'react';
import styles from './ui.module.css';

/** What a screen shows while its data is on the way. One look everywhere, announced to screen readers. */
export function Loading({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <div className={styles.loading} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      {label}
    </div>
  );
}

/** What a list shows when it has nothing yet: what is missing, and how to get the first item. */
export function Empty({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className={styles.emptyNote}>
      <strong>{title}</strong>
      {hint && <span>{hint}</span>}
      {children}
    </div>
  );
}
