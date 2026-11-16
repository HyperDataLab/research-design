import { useEffect, useState, type ReactNode } from 'react';
import { ToastContext } from './toastContext';
import styles from './ui.module.css';
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  return (
    <ToastContext.Provider value={(message) => setToast({ message })}>
      {children}
      {toast && (
        <div role="status" className={styles.toast}>
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}
