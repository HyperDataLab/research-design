import type { ReactNode } from 'react';
import styles from './ui.module.css';
export function Tooltip({
  label,
  children,
  placement = 'top',
}: {
  label: string;
  children: ReactNode;
  placement?: 'top' | 'right';
}) {
  return (
    <span
      className={`${styles.tooltip} ${placement === 'right' ? styles.tooltipRight : ''}`}
      data-label={label}
    >
      {children}
    </span>
  );
}
