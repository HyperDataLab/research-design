import { ChevronDown } from 'lucide-react';
import { useId, type SelectHTMLAttributes } from 'react';
import styles from './ui.module.css';
type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  label: string;
  size?: 'md' | 'sm';
  inline?: boolean;
  /** Keep the label for screen readers only, when the first option already says what the list is. */
  hideLabel?: boolean;
};
export function Select({
  label,
  size = 'md',
  inline = false,
  hideLabel = false,
  id,
  className = '',
  ...props
}: Props) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return (
    <label className={`${styles.field} ${inline ? styles.fieldInline : ''} ${className}`} htmlFor={controlId}>
      <span className={hideLabel ? styles.srOnly : undefined}>{label}</span>
      <span className={styles.selectWrap}>
        <select
          {...props}
          id={controlId}
          className={`${styles.fieldControl} ${size === 'sm' ? styles.controlSm : styles.controlMd}`}
        />
        <ChevronDown className={styles.selectChevron} size={15} aria-hidden="true" />
      </span>
    </label>
  );
}
