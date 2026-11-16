import type { ReactNode } from 'react';
import styles from './ui.module.css';
export function Card({ children, padding = 'lg' }: { children: ReactNode; padding?: 'md' | 'lg' }) {
  return <section className={`${styles.card} ${padding === 'md' ? styles.cardMd : ''}`}>{children}</section>;
}
