import type { DraftHypothesis } from '@/core/draft/schema';
import type { BankClaimType } from '@/core/bank/snapshot';

export const kinds: Record<DraftHypothesis['kind'], string> = {
  directional: 'Có hướng',
  non_directional: 'Không hướng',
  equivalence: 'Tương đương',
  exploratory: 'Thăm dò',
};

export function claimLabel(id: string | null, claims: BankClaimType[]): string {
  if (!id) return 'Chưa phân loại nhận định';
  const claim = claims.find((entry) => entry.id === id);
  return claim ? `${claim.name}${claim.status === 'draft' ? ' · Bản nháp' : ''}` : id;
}
