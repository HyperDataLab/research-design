import styles from './ui.module.css';
export function Meter({
  value,
  max,
  tone,
  'aria-label': label,
}: {
  value: number;
  max: number;
  tone: 'ok' | 'warning' | 'over';
  'aria-label': string;
}) {
  const boundedMax = Math.max(0, max);
  const boundedValue = Math.max(0, Math.min(value, boundedMax));
  return (
    <div
      className={styles.meter}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={boundedMax}
      aria-valuenow={boundedValue}
      data-tone={tone}
    >
      <div
        className={styles.meterFill}
        style={{ width: boundedMax ? (boundedValue / boundedMax) * 100 + '%' : '100%' }}
      />
    </div>
  );
}
