import styles from './ui.module.css';

/** An empty screen: what is missing, what to do, and a technical note. Not a heading, so the page keeps one h1. */
export function EmptyState({
  title,
  description,
  detail,
}: {
  title: string;
  description: string;
  detail: string;
}) {
  return (
    <div className={styles.emptyNote}>
      <strong>{title}</strong>
      <span>{description}</span>
      <span className={styles.detail}>{detail}</span>
    </div>
  );
}
