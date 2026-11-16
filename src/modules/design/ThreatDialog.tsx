import { useState } from 'react';
import type { DraftThreat } from '@/core/draft/schema';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { TextField } from '@/shared/ui/TextField';
import styles from './Page.module.css';

export function ThreatDialog({
  threat,
  close,
  save,
}: {
  threat: DraftThreat | null;
  close: () => void;
  save: (name: string, mitigation: string) => void;
}) {
  const [name, setName] = useState(threat?.name ?? '');
  const [mitigation, setMitigation] = useState(threat?.mitigation ?? '');
  return (
    <Dialog
      title={threat ? 'Sửa mối đe doạ' : 'Thêm mối đe doạ'}
      description="Ghi mối đe doạ và cách giảm trong nghiên cứu này."
      onClose={close}
    >
      <div className={styles.stack}>
        <TextField label="Tên mối đe doạ" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField
          multiline
          label="Cách giảm trong nghiên cứu này"
          value={mitigation}
          onChange={(e) => setMitigation(e.target.value)}
        />
        <div className={styles.actions}>
          <Button onClick={close}>Hủy</Button>
          <Button disabled={!name.trim()} onClick={() => save(name, mitigation)}>
            Lưu
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
