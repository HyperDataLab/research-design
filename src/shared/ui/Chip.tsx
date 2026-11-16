import type { ComponentProps } from 'react';
import { Button } from './Button';
import styles from './ui.module.css';

const number = new Intl.NumberFormat('vi-VN');

export function Chip({
  className = '',
  count,
  children,
  ...props
}: ComponentProps<typeof Button> & { count?: number }) {
  return (
    <Button {...props} size="sm" className={`${styles.chip} ${className}`}>
      {children}
      {count !== undefined && ' '}
      {count !== undefined && (
        <span className={styles.chipCount}>
          <span className={styles.srOnly}>(</span>
          {number.format(count)}
          <span className={styles.srOnly}>)</span>
        </span>
      )}
    </Button>
  );
}
