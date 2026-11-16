import { modules } from '@/app/modules';
import { GROUPS } from '@/app/groups';
import { StageList } from '@/shared/workflow/StageList';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Badge } from '@/shared/ui/Badge';
import { useProject } from '@/shared/project/projectContext';
import Members from './Members';
import styles from '@/modules/home/home.module.css';
export default function ProjectHome() {
  const { project, readOnly } = useProject();
  return (
    <>
      <PageHeader title={project.title} lead="Các bước của dự án." />
      {readOnly && <Badge>Đã lưu trữ · chỉ đọc</Badge>}
      <StageList groups={GROUPS} modules={modules} styles={styles} projectId={project.id} />
      <Members />
    </>
  );
}
