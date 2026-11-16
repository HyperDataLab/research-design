import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './ui.module.css';

/** A row of tabs. When they do not fit, the row scrolls and a fade marks the side with hidden tabs. */
export function Tabs({ children, label }: { children: ReactNode; label: string }) {
  const list = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ left: false, right: false });
  useEffect(() => {
    const element = list.current;
    if (!element) return;
    const measure = () =>
      setMore({
        left: element.scrollLeft > 2,
        right: element.scrollLeft + element.clientWidth < element.scrollWidth - 2,
      });
    measure();
    element
      .querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    element.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      element.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [children]);
  return (
    <div className={styles.tabsWrap} data-more-left={more.left} data-more-right={more.right}>
      <div ref={list} className={styles.tabs} role="tablist" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

const number = new Intl.NumberFormat('vi-VN');

/** The number of entries behind a tab, set apart from its name. */
export function TabCount({ value }: { value: number }) {
  return (
    <span className={styles.tabCount}>
      <span className={styles.srOnly}>(</span>
      {number.format(value)}
      <span className={styles.srOnly}>)</span>
    </span>
  );
}
