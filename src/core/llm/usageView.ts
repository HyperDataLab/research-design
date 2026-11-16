export function budgetLevel(used: number, budget: number): 'ok' | 'warning' | 'over' {
  if (budget <= 0 || used >= budget) return 'over';
  return used / budget >= 0.8 ? 'warning' : 'ok';
}
export function formatTokens(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n);
}
