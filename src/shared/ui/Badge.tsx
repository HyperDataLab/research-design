import type { ReactNode } from 'react';
import styles from './ui.module.css';
export function Badge({
  children,
  tone = 'neutral',
  icon,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
  icon?: ReactNode;
}) {
  return (
    <span className={`${styles.badge} ${tone === 'neutral' ? '' : styles[`tone_${tone}`]}`}>
      {icon}
      {children}
    </span>
  );
}
