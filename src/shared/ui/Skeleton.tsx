import styles from './ui.module.css';
export function Skeleton() {
  return <div className={styles.skeleton} role="status" aria-label="Đang tải" />;
}
