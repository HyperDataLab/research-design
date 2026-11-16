import { NavLink, useLocation } from 'react-router-dom';
import { Badge } from '@/shared/ui/Badge';
import type { ModuleDefinition } from './moduleTypes';
import { modules } from './modules';
import styles from './shell.module.css';

export function SidebarItem({
  item,
  onNavigate,
  quiet = false,
}: {
  item: ModuleDefinition;
  onNavigate?: () => void;
  quiet?: boolean;
}) {
  const { pathname } = useLocation();
  const childActive = modules.some((other) => other.partOf === item.id && pathname.startsWith(other.path));
  const className = `${styles.navItem} ${quiet ? styles.quietItem : ''}`;
  const content = (
    <>
      <span className={styles.itemLabel}>{item.label}</span>
      {item.status === 'soon' && <Badge>Sắp có</Badge>}
      {item.status === 'beta' && <Badge>Beta</Badge>}
    </>
  );
  if (item.status === 'soon')
    return (
      <span className={`${className} ${styles.disabled}`} aria-disabled="true">
        {content}
      </span>
    );
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      onClick={onNavigate}
      className={({ isActive }) => `${className} ${isActive || childActive ? styles.active : ''}`}
    >
      {content}
    </NavLink>
  );
}
