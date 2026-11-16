import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';

type Props = {
  groups: { id: string; label: string }[];
  modules: { id: string; group: string; label: string; summary: string; status: string }[];
  styles: Record<string, string>;
};

export function StageList({ groups, modules, styles }: Props) {
  const stages = groups.filter((group) => group.label);
  return (
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
  );
}
