import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  type Ref,
} from 'react';
import styles from './ui.module.css';

type Common = {
  label: string;
  hint?: string;
  error?: string;
  size?: 'md' | 'sm';
  /** Keep the label for screen readers only, when an icon and placeholder already say what the box is. */
  hideLabel?: boolean;
  /** An icon inside the box, before the text. Single-line fields only. */
  leadingIcon?: ReactNode;
};
type Props = Common &
  (
    | ({ multiline?: false; ref?: Ref<HTMLInputElement> } & Omit<
        InputHTMLAttributes<HTMLInputElement>,
        'size'
      >)
    | ({ multiline: true; ref?: Ref<HTMLTextAreaElement> } & TextareaHTMLAttributes<HTMLTextAreaElement>)
  );
export function TextField({
  label,
  hint,
  error,
  size = 'md',
  hideLabel = false,
  leadingIcon,
  ...props
}: Props) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  const control = props.multiline
    ? (() => {
        const { multiline: _multiline, ...rest } = props;
        void _multiline;
        return (
          <textarea
            {...rest}
            id={id}
            className={`${styles.fieldControl} ${styles.multiline}`}
            aria-invalid={!!error}
            aria-describedby={describedBy}
          />
        );
      })()
    : (() => {
        const { multiline: _multiline, ...rest } = props;
        void _multiline;
        return (
          <input
            {...rest}
            id={id}
            className={`${styles.fieldControl} ${size === 'sm' ? styles.controlSm : styles.controlMd}`}
            aria-invalid={!!error}
            aria-describedby={describedBy}
          />
        );
      })();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={hideLabel ? styles.srOnly : undefined}>
        {label}
      </label>
      {leadingIcon && !props.multiline ? (
        <span className={styles.inputWrap}>
          <span className={styles.inputIcon} aria-hidden="true">
            {leadingIcon}
          </span>
          {control}
        </span>
      ) : (
        control
      )}
      {hint && (
        <span id={`${id}-hint`} className={styles.fieldHint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className={styles.fieldError}>
          {error}
        </span>
      )}
    </div>
  );
}
