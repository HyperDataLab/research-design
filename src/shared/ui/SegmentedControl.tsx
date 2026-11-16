import { useRef, type KeyboardEvent } from 'react';
import { Button } from './Button';
import styles from './ui.module.css';
export function SegmentedControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || options.length === 0)
      return;
    event.preventDefault();
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const next =
      (options.findIndex((option) => option.value === value) + direction + options.length) % options.length;
    const option = options[next];
    if (option) {
      onChange(option.value);
      ref.current?.querySelectorAll<HTMLButtonElement>('[role=radio]')[next]?.focus();
    }
  }
  return (
    <div ref={ref} role="radiogroup" aria-label={label} className={styles.segments} onKeyDown={keyDown}>
      {options.map((option) => (
        <Button
          key={option.value}
          role="radio"
          aria-checked={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          size="sm"
          className={styles.segment}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
