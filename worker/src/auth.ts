import { jwtVerify, type JWTVerifyGetKey } from 'jose';

export const SECURETOKEN_JWKS =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

/** True only for an address whose domain is exactly `domain`: one '@', no sub-domain, no look-alike. */
export function emailAllowed(email: unknown, domain: string): email is string {
  if (typeof email !== 'string') return false;
  const at = email.indexOf('@');
  return at > 0 && at === email.lastIndexOf('@') && email.slice(at + 1).toLowerCase() === domain;
}

export class NotAllowedError extends Error {}

/** A signed-in lab member, as the token says. */
export interface Caller {
  uid: string;
  email: string;
  /** The Google display name, or the email when the account has none. */
  name: string;
}

/**
 * Checks a Firebase ID token: Google's signature, this project as issuer and audience, a verified Google
 * account. A good token from another domain is `NotAllowedError` (403); anything else throws (401).
 */
export async function verifyFirebaseToken(
  token: string,
  jwks: JWTVerifyGetKey,
  projectId: string,
  domain: string,
): Promise<Caller> {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ['RS256'],
  });
  const provider = (payload.firebase as { sign_in_provider?: string } | undefined)?.sign_in_provider;
  if (!payload.sub || payload.email_verified !== true || provider !== 'google.com')
    throw new Error('unverified account');
  if (!emailAllowed(payload.email, domain)) throw new NotAllowedError('domain not allowed');
  const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : payload.email;
  return { uid: payload.sub, email: payload.email.toLowerCase(), name };
}
