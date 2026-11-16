export type MemberEmailResult =
  | { ok: true; email: string }
  | { ok: false; error: 'malformed' | 'foreign_domain' | 'already_member' | 'too_many' };

export function checkMemberEmail(input: string, members: string[], allowedDomain: string): MemberEmailResult {
  const email = input.trim().toLowerCase();
  if (!/^[^\s/@]+@[^\s/@]+$/.test(email)) return { ok: false, error: 'malformed' };
  if (email.split('@')[1] !== allowedDomain.toLowerCase()) return { ok: false, error: 'foreign_domain' };
  if (members.some((member) => member.toLowerCase() === email)) return { ok: false, error: 'already_member' };
  if (members.length >= 50) return { ok: false, error: 'too_many' };
  return { ok: true, email };
}

export function sortMembers(members: string[], owner: string): string[] {
  return [...members].sort((a, b) =>
    a === owner ? (b === owner ? 0 : -1) : b === owner ? 1 : a.localeCompare(b),
  );
}
