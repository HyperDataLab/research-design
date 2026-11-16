import { Link } from 'react-router-dom';
import type { Draft, DraftVariable } from '@/core/draft/schema';
import { word } from './words';
import styles from './Page.module.css';

export function VariablesTab({ item, draft }: { item: DraftVariable; draft: Draft }) {
  return (
    <p className={styles.quiet}>
      {word(item.role)}
      {item.construct && ` · Khái niệm: ${item.construct}`}
      {(item.role === 'dependent' || item.role === 'covariate') && (
        <>
          {' · '}
          {item.metric ? (
            <Link to="?tab=metrics">
              Metric: {item.metric} {draft.metrics.find((m) => m.id === item.metric)?.name}
            </Link>
          ) : (
            'chưa có metric'
          )}
        </>
      )}
      {item.role === 'independent' &&
        ` · ${item.levels.length ? `Các mức: ${item.levels.join(', ')}` : 'chưa có mức'}`}
    </p>
  );
}
