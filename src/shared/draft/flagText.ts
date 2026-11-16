import { findClaimType, findDesign } from '@/core/bank/readSnapshot';
import type { BankDoc } from '@/core/bank/snapshot';
import type { DesignFlag } from '@/core/draft/checkDesign';
import type { Draft } from '@/core/draft/schema';

export function flagText(flag: DesignFlag, draft: Draft, bank: BankDoc | null): string {
  switch (flag.rule) {
    case 'DS-01':
      return `${flag.subject} là nhận định ${findClaimType(bank, flag.claim)?.name ?? flag.claim}; thiết kế «${findDesign(bank, flag.design)?.name ?? draft.design?.name ?? flag.design}» không hỗ trợ loại nhận định này.`;
    case 'DS-02':
      return `${flag.subject} chưa có loại nhận định cho thiết kế «${draft.design?.name ?? ''}».`;
    case 'DS-03':
      return `Thiết kế «${draft.design?.name ?? ''}» chưa có cách phân nhóm.`;
    case 'DS-04':
      return `${flag.subject} «${draft.threats.find((t) => t.id === flag.subject)?.name ?? ''}» chưa ghi cách giảm.`;
    case 'DS-05': {
      const object =
        flag.reference === 'design'
          ? `Thiết kế «${draft.design?.name ?? flag.id}» (${flag.id})`
          : flag.reference === 'threat'
            ? `${flag.subject} «${draft.threats.find((t) => t.id === flag.subject)?.name ?? ''}»: mục ${flag.id}`
            : `${flag.subject}: loại nhận định ${flag.id}`;
      const reason =
        flag.reason === 'no_snapshot'
          ? 'chưa đối chiếu được vì dự án chưa có bản chụp Writing Bank'
          : flag.reason === 'other_release'
            ? 'thuộc bản chụp cũ'
            : 'không còn trong bản chụp hiện tại';
      return `${object} ${reason}.`;
    }
  }
}
