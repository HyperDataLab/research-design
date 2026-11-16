import type { ModuleDefinition } from './moduleTypes';
import { modules } from './modules';
import { SidebarItem } from './SidebarItem';
import styles from './shell.module.css';

export function SidebarGroup({
  group,
  onNavigate,
  quiet = false,
}: {
  group: { id: ModuleDefinition['group']; label: string };
  onNavigate?: () => void;
  /** Secondary links, set smaller. */
  quiet?: boolean;
}) {
  const items = modules.filter((item) => item.group === group.id && !item.partOf);
  if (!items.length) return null;
  const labelId = `nav-group-${group.id}`;
  return (
    <div
      className={quiet ? styles.quietGroup : styles.group}
      role={group.label ? 'group' : undefined}
      aria-labelledby={group.label ? labelId : undefined}
    >
      {group.label && (
        <div id={labelId} className={styles.groupTitle}>
          {group.label}
        </div>
      )}
      {items.map((item) => (
        <SidebarItem key={item.id} item={item} onNavigate={onNavigate} quiet={quiet} />
      ))}
    </div>
  );
}
