import { Link } from 'react-router-dom';
import { GROUPS } from './groups';
import { SidebarGroup } from './SidebarGroup';
import styles from './shell.module.css';

/**
 * Text only. The labels are short and distinct, so icons would add a second, weaker code for the same thing;
 * that is also why there is no icon rail.
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className={styles.sidebar}>
      <Link to="/" className={styles.brand} onClick={onNavigate} aria-label="Research Design, về Tổng quan">
        <span className={styles.mark} aria-hidden="true">
          Δ
        </span>
        <span className={styles.brandText}>
          <strong>Research Design</strong>
          <small>HyperDataLab</small>
        </span>
      </Link>
      <nav aria-label="Điều hướng chính" className={styles.navigation}>
        {GROUPS.filter((group) => group.id !== 'system').map((group) => (
          <SidebarGroup key={group.id} group={group} onNavigate={onNavigate} />
        ))}
      </nav>
      <nav aria-label="Hệ thống" className={styles.sidebarFooter}>
        <SidebarGroup group={{ id: 'system', label: '' }} onNavigate={onNavigate} quiet />
      </nav>
    </aside>
  );
}
