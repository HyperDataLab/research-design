import type { ReactNode } from 'react';
import styles from './ui.module.css';

/** The top of a page: its one h1, a line saying what the page is for, and the page-level actions. */
export function PageHeader({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <h1>{title}</h1>
        {lead && <p>{lead}</p>}
      </div>
      {children && <div className={styles.pageActions}>{children}</div>}
    </header>
  );
}
