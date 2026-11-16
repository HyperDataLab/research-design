import type { ComponentProps } from 'react';
import { Button } from './Button';
import { Tooltip } from './Tooltip';
import styles from './ui.module.css';
export function IconButton({
  className = '',
  label,
  ...props
}: ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip label={label}>
      <Button aria-label={label} className={`${styles.iconButton} ${className}`} {...props} />
    </Tooltip>
  );
}
