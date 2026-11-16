import { ChevronRight } from 'lucide-react';
import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import styles from './ui.module.css';

export interface TreeNode {
  id: string;
  label: ReactNode;
  /** Short muted text at the end of the row, such as a count. */
  meta?: ReactNode;
  children?: TreeNode[];
}
interface Row {
  node: TreeNode;
  depth: number;
  position: number;
  siblings: number;
  parentId: string | null;
}

function ancestorsOf(
  nodes: TreeNode[],
  id: string | null | undefined,
  trail: string[] = [],
): string[] | null {
  for (const node of nodes) {
    if (node.id === id) return trail;
    const found = node.children && ancestorsOf(node.children, id, [...trail, node.id]);
    if (found) return found;
  }
  return null;
}

function visibleRows(nodes: TreeNode[], open: Set<string>, depth = 1, parentId: string | null = null): Row[] {
  return nodes.flatMap((node, index) => [
    { node, depth, position: index + 1, siblings: nodes.length, parentId },
    ...(node.children?.length && open.has(node.id)
      ? visibleRows(node.children, open, depth + 1, node.id)
      : []),
  ]);
}

/** An outline with expandable rows and the keyboard behaviour of the ARIA tree pattern. */
export function Tree({
  label,
  nodes,
  selectedId,
  onSelect,
  defaultExpanded = [],
}: {
  label: string;
  nodes: TreeNode[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  defaultExpanded?: string[];
}) {
  const [expanded, setExpanded] = useState(() => new Set(defaultExpanded));
  const [revealed, setRevealed] = useState<string | null | undefined>(undefined);
  const [focused, setFocused] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  if (revealed !== selectedId) {
    setRevealed(selectedId);
    const ancestors = ancestorsOf(nodes, selectedId);
    if (ancestors?.some((id) => !expanded.has(id))) setExpanded(new Set([...expanded, ...ancestors]));
  }
  const rows = useMemo(() => visibleRows(nodes, expanded), [nodes, expanded]);
  const current = focused ?? selectedId ?? rows[0]?.node.id ?? null;
  const tabStop = rows.some((row) => row.node.id === current) ? current : (rows[0]?.node.id ?? null);

  function focus(id: string) {
    setFocused(id);
    container.current?.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(id)}"]`)?.focus();
  }
  function setOpen(id: string, open: boolean) {
    const next = new Set(expanded);
    if (open) next.add(id);
    else next.delete(id);
    setExpanded(next);
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>, row: Row, index: number) {
    const hasChildren = Boolean(row.node.children?.length);
    const open = expanded.has(row.node.id);
    const target =
      event.key === 'ArrowDown'
        ? rows[index + 1]?.node.id
        : event.key === 'ArrowUp'
          ? rows[index - 1]?.node.id
          : event.key === 'Home'
            ? rows[0]?.node.id
            : event.key === 'End'
              ? rows.at(-1)?.node.id
              : event.key === 'ArrowLeft' && !(hasChildren && open)
                ? (row.parentId ?? undefined)
                : event.key === 'ArrowRight' && hasChildren && open
                  ? rows[index + 1]?.node.id
                  : undefined;
    if (target) focus(target);
    else if (event.key === 'ArrowRight' && hasChildren) setOpen(row.node.id, true);
    else if (event.key === 'ArrowLeft' && hasChildren && open) setOpen(row.node.id, false);
    else if (event.key === 'Enter' || event.key === ' ') onSelect(row.node.id);
    else return;
    event.preventDefault();
  }
  return (
    <div ref={container} role="tree" aria-label={label} className={styles.tree}>
      {rows.map((row, index) => {
        const hasChildren = Boolean(row.node.children?.length);
        const open = expanded.has(row.node.id);
        return (
          <div
            key={row.node.id}
            role="treeitem"
            data-tree-id={row.node.id}
            aria-level={row.depth}
            aria-posinset={row.position}
            aria-setsize={row.siblings}
            aria-selected={selectedId === row.node.id}
            aria-expanded={hasChildren ? open : undefined}
            tabIndex={row.node.id === tabStop ? 0 : -1}
            className={styles.treeRow}
            style={{ '--tree-depth': row.depth - 1 } as CSSProperties}
            onClick={() => {
              setFocused(row.node.id);
              onSelect(row.node.id);
            }}
            onKeyDown={(event) => keyDown(event, row, index)}
          >
            {hasChildren ? (
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                className={styles.treeToggle}
                data-open={open}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(row.node.id, !open);
                }}
              >
                <ChevronRight size={14} />
              </button>
            ) : (
              <span className={styles.treeToggle} aria-hidden="true" />
            )}
            <span className={styles.treeLabel}>{row.node.label}</span>
            {row.node.meta !== undefined && <span className={styles.treeMeta}>{row.node.meta}</span>}
          </div>
        );
      })}
    </div>
  );
}
