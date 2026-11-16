import type { BankDoc } from '@/core/bank/snapshot';
import type { DesignFlag } from '@/core/draft/checkDesign';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';

export function RepinNotice({
  flags,
  bank,
  readOnly,
  onRepin,
}: {
  flags: DesignFlag[];
  bank: BankDoc | null;
  readOnly: boolean;
  onRepin: (bank: BankDoc) => void;
}) {
  if (!flags.some((flag) => flag.rule === 'DS-05' && flag.reason === 'other_release')) return null;
  return (
    <Card>
      <p>Một số tham chiếu thuộc bản chụp cũ nhưng vẫn có trong bản chụp hiện tại.</p>
      {!readOnly && bank && (
        <Button variant="ghost" onClick={() => onRepin(bank)}>
          Ghim lại theo bản chụp hiện tại
        </Button>
      )}
    </Card>
  );
}
