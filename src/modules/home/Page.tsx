import { GROUPS } from '@/app/groups';
import { modules } from '@/app/modules';
import { StageList } from '@/shared/workflow/StageList';
import { PageHeader } from '@/shared/ui/PageHeader';
import styles from './home.module.css';

/** The workflow at a glance: one card per stage, one line per screen, and whether the screen exists yet. */
export default function HomePage() {
  return (
    <>
      <PageHeader
        title="Tổng quan"
        lead="Từ các bài báo đã đọc đến một kế hoạch thí nghiệm đã đóng băng, sẵn sàng giao cho Scientific Research Desktop."
      />
      <StageList groups={GROUPS} modules={modules} styles={styles} />
    </>
  );
}
