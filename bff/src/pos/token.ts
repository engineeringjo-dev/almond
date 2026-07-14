import { createHmac, randomUUID } from 'node:crypto';
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

const usedJti = new Set<string>(); // single-use; swap for Redis w/ TTL in prod

export function verifyPosToken(token: string): { memberId: string } {
  const [body, sig] = (token ?? '').split('.');
  if (!body || !sig) throw unauthorized('malformed pos token');
  const expected = sign(body);
  if (sig.length !== expected.length || sign(body) !== expected || sig !== expected) throw unauthorized('bad pos signature');
  let payload: { sub: string; jti: string; exp: number };
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { throw unauthorized('bad pos token'); }
  if (payload.exp < Math.floor(Date.now() / 1000)) throw unauthorized('pos token expired');
  if (usedJti.has(payload.jti)) throw conflict('pos_token_replay', 'pos token already used');
  usedJti.add(payload.jti);
  return { memberId: payload.sub };
}
