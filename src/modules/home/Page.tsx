import { GROUPS } from '@/app/groups';
import { modules } from '@/app/modules';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import styles from './home.module.css';

/** The workflow at a glance: one card per stage, one line per screen, and whether the screen exists yet. */
export default function HomePage() {
  const stages = GROUPS.filter((group) => group.label);
  return (
    <>
      <PageHeader
        title="Tổng quan"
        lead="Từ các bài báo đã đọc đến một kế hoạch thí nghiệm đã đóng băng, sẵn sàng giao cho Scientific Research Desktop."
      />
      <div className={styles.stages}>
        {stages.map((stage, index) => (
          <Card key={stage.id} padding="md">
            <h2 className={styles.stageTitle}>
              {index + 1}. {stage.label}
            </h2>
            <ul className={styles.steps}>
              {modules
                .filter((item) => item.group === stage.id)
                .map((item) => (
                  <li key={item.id}>
                    <span className={styles.stepName}>
                      {item.label}
                      {item.status === 'soon' && <Badge>Sắp có</Badge>}
                    </span>
                    <span className={styles.stepSummary}>{item.summary}</span>
                  </li>
                ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
