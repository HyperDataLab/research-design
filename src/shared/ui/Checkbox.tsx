import { useEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './ui.module.css';
export function Checkbox({
  children,
  indeterminate = false,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { children: ReactNode; indeterminate?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (input.current) input.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className={styles.checkbox}>
      <input {...props} ref={input} type="checkbox" />
      {children}
    </label>
  );
}
