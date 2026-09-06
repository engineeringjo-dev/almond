import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { config } from '../config';
import { conflict, unauthorized } from '../http-error';

/** Short-lived, HMAC-signed, single-use POS token — replaces the static QR
 *  (`ALMOND|MEMBER|<userId>|MODE=PAY`) which was forgeable and replayable. */
const b64u = (v: string): string => Buffer.from(v).toString('base64url');
const sign = (body: string): string => createHmac('sha256', config.POS_TOKEN_SECRET).update(body).digest('base64url');

export function issuePosToken(memberId: string): { token: string; expiresIn: number } {
  const payload = { sub: memberId, jti: randomUUID(), exp: Math.floor(Date.now() / 1000) + config.POS_TOKEN_TTL_SECONDS };
  const body = b64u(JSON.stringify(payload));
  return { token: `${body}.${sign(body)}`, expiresIn: config.POS_TOKEN_TTL_SECONDS };
}

/**
 * Spent token ids, each held only until the token it belongs to would have
 * expired anyway — after that the `exp` check rejects it and remembering the
 * jti adds nothing. The previous `Set<string>` never dropped an entry, so the
 * replay guard was also an unbounded leak. Still per-process: two BFF instances
 * do not share it, so a replay against the OTHER instance succeeds. That is the
 * same Redis change `bff/src/auth/otp.ts` needs and they should move together.
 */
const usedJti = new Map<string, number>();

/** Constant-time signature compare — `!==` on an HMAC leaks it byte by byte. */
function sigMatches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyPosToken(token: string): { memberId: string } {
  const [body, sig] = (token ?? '').split('.');
  if (!body || !sig) throw unauthorized('malformed pos token');
  if (!sigMatches(sig, sign(body))) throw unauthorized('bad pos signature');
  let payload: { sub: string; jti: string; exp: number };
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { throw unauthorized('bad pos token'); }
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp < nowSec) throw unauthorized('pos token expired');
  for (const [jti, exp] of usedJti) if (exp < nowSec) usedJti.delete(jti);
  if (usedJti.has(payload.jti)) throw conflict('pos_token_replay', 'pos token already used');
  usedJti.set(payload.jti, payload.exp);
  return { memberId: payload.sub };
}
