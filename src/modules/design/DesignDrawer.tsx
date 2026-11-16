import { useState } from 'react';
import type { BankDoc } from '@/core/bank/snapshot';
import { designFromBank } from '@/core/draft/ops';
import type { DraftDesign } from '@/core/draft/schema';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Drawer } from '@/shared/ui/Drawer';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { TextField } from '@/shared/ui/TextField';
import { assignments, word } from './words';
import styles from './Page.module.css';

export function DesignDrawer({
  bank,
  projectId,
  onClose,
  choose,
}: {
  bank: BankDoc | null;
  projectId: string;
  onClose: () => void;
  choose: (design: DraftDesign) => void;
}) {
  const [name, setName] = useState('');
  const [assignment, setAssignment] = useState<DraftDesign['assignment']>(null);
  return (
    <Drawer open onClose={onClose} side="right" label="Chọn thiết kế">
      <h2>Chọn thiết kế</h2>
      {!bank && (
        <p>
          Chưa có bản chụp. <a href={`/p/${projectId}/bank`}>Writing Bank</a>
        </p>
      )}
      {bank?.collections.designs.map((d) => (
        <div className={styles.row} key={d.id}>
          <h3>{d.name}</h3>
          {d.status === 'draft' && <Badge>Bản nháp của bank</Badge>}
          <p>
            {word('family', d.family)} · {word('causalLicence', d.causalLicence)}
          </p>
          <p>{d.definition.match(/^.*?[.!?](?:\s|$)/)?.[0].trim() ?? d.definition}</p>
          <Button onClick={() => choose(designFromBank(d, bank.release))}>Chọn</Button>
        </div>
      ))}
      <div className={styles.row}>
        <h3>Tự mô tả thiết kế</h3>
        <TextField label="Tên thiết kế" value={name} onChange={(e) => setName(e.target.value)} />
        <p>Cách phân nhóm</p>
        <SegmentedControl
          label="Cách phân nhóm"
          value={assignment ?? ''}
          options={assignments}
          onChange={(v) => setAssignment(v as DraftDesign['assignment'])}
        />
        <Button disabled={!name.trim()} onClick={() => choose({ name, assignment, bank: null })}>
          Chọn thiết kế tự mô tả
        </Button>
      </div>
    </Drawer>
  );
}
