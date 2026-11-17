import type { Paper } from '@/core/papers/papers';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { decisionLabels } from './view';
import styles from './Page.module.css';
export function PaperRow({
  paper,
  readOnly,
  decide,
  exclude,
  fetchFacts,
  hasFacts,
}: {
  paper: Paper;
  readOnly: boolean;
  decide: (decision: Paper['decision']) => void;
  exclude: () => void;
  fetchFacts?: () => void;
  hasFacts?: boolean;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.title}>{paper.title}</div>
      <div className={styles.meta}>
        {[paper.authors.join(', '), paper.year, paper.venue].filter(Boolean).join(' · ')}
      </div>
      {paper.doi && (
        <div>
          <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noreferrer">
            {paper.doi}
          </a>
        </div>
      )}
      <div className={styles.badges}>
        <Badge>{decisionLabels[paper.decision]}</Badge>
        {paper.model && <Badge>Có paper model</Badge>}
      </div>
      {paper.reason && <div>Lý do: {paper.reason}</div>}
      {!readOnly && (
        <div className={styles.actions}>
          {paper.model?.paperlab && fetchFacts && (
            <Button variant="ghost" onClick={fetchFacts}>
              {hasFacts ? 'Cập nhật dữ kiện' : 'Lấy dữ kiện'}
            </Button>
          )}
          {paper.decision !== 'included' && (
            <Button variant="ghost" onClick={() => decide('included')}>
              Chọn
            </Button>
          )}
          {paper.decision !== 'excluded' && (
            <Button variant="ghost" onClick={exclude}>
              Loại
            </Button>
          )}
          {paper.decision !== 'undecided' && (
            <Button variant="ghost" onClick={() => decide('undecided')}>
              Bỏ quyết định
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
