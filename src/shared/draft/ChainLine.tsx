import { Link } from 'react-router-dom';
import { chainOf } from '@/core/draft/checkChain';
import type { Draft } from '@/core/draft/schema';
import { Badge } from '@/shared/ui/Badge';
import styles from './ChainLine.module.css';

export function ChainLine({
  draft,
  hypothesisId,
  projectId,
}: {
  draft: Draft;
  hypothesisId: string;
  projectId: string;
}) {
  const chain = chainOf(draft, hypothesisId);
  if (!chain.hypothesis) return null;
  const target = `/p/${encodeURIComponent(projectId)}/measurement`;
  const link = (id: string, name?: string) => (
    <Link to={target}>
      <span className={styles.id}>{id}</span>
      {name ? ` ${name}` : ''}
    </Link>
  );
  const warning = (text: string) => (
    <span className={styles.warning}>
      <Badge tone="warning">Cần xem lại</Badge> {text}
    </span>
  );
  return (
    <div>
      {chain.dependent.length === 0 ? (
        <div>
          {link(hypothesisId)} → {warning('chưa gắn biến phụ thuộc')}
        </div>
      ) : (
        chain.dependent.map(({ variable, metric }, index) => (
          <div key={chain.hypothesis?.dependent[index]}>
            {link(hypothesisId)} →{' '}
            {variable ? link(variable.id, variable.name) : warning('biến phụ thuộc không tồn tại')} →{' '}
            {variable &&
              (metric ? (
                <>
                  {link(metric.id)}{' '}
                  {metric.key ? (
                    <span className={styles.id}>{metric.key}</span>
                  ) : (
                    warning('metric chưa có key')
                  )}
                </>
              ) : (
                warning(variable.metric ? 'metric không tồn tại' : 'chưa có metric')
              ))}
          </div>
        ))
      )}
      {chain.independent.length > 0 && (
        <div className={styles.quiet}>
          Biến độc lập:{' '}
          {chain.independent.map((v, index) => (
            <span key={v.id}>
              {index > 0 && ', '}
              {link(v.id, v.name)} ({v.levels.join(', ')})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
