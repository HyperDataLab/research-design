import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './ui.module.css';
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  leadingIcon?: ReactNode;
};
export function Button({
  className = '',
  variant = 'secondary',
  size = 'md',
  type = 'button',
  leadingIcon,
  children,
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={`${styles.button} ${size === 'sm' ? styles.controlSm : styles.controlMd} ${variant === 'secondary' ? '' : styles[variant]} ${className}`}
      {...props}
    >
      {leadingIcon}
      {children}
    </button>
  );
}
