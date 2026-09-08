import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { POS_MODES, type PosMode } from '@almond/shared/pos/tokenWire';
import { config } from '../config';
import { conflict, unauthorized } from '../http-error';

/** Short-lived, HMAC-signed, single-use POS token — replaces the static QR
 *  (a pipe-delimited `MEMBER` string carrying the raw member id) which was
 *  forgeable from data printed on the member's own screen, and replayable. */
const b64u = (v: string): string => Buffer.from(v).toString('base64url');
const sign = (body: string): string => createHmac('sha256', config.POS_TOKEN_SECRET).update(body).digest('base64url');

/**
 * `mode` is a SIGNED CLAIM, and that is the whole reason it is in here.
 *
 * The retired barcode carried the member's pay-vs-earn choice as plaintext the
 * device itself wrote, next to a member id anyone could read. Moving the
 * identity into a signed token and leaving the mode outside it would have left
 * the Pay screen's toggle controlling nothing: the till resolves the member
 * from `POST /v1/pos/scan`, and a mode the scan response does not carry cannot
 * reach the till at all. So the member's intent travels the one channel between
 * the phone and the counter that cannot be tampered with — the token.
 *
 * Nothing in this repo spends money on the mode (the till decides what it
 * rings), so a forged mode buys an attacker nothing today; it is signed because
 * it is cheaper to sign it now than to discover later that it was not.
 */
interface PosTokenPayload {
  sub: string;
  mode?: PosMode;
  jti: string;
  exp: number;
}

export function issuePosToken(memberId: string, mode: PosMode = 'pay'): { token: string; expiresIn: number; mode: PosMode } {
  const payload: PosTokenPayload = {
    sub: memberId,
    mode,
    jti: randomUUID(),
    // config.POS_TOKEN_TTL_SECONDS — the shared 60s, overridable by env. Never
    // a literal: the phone refreshes off the `expiresIn` this returns.
    exp: Math.floor(Date.now() / 1000) + config.POS_TOKEN_TTL_SECONDS,
  };
  const body = b64u(JSON.stringify(payload));
  return { token: `${body}.${sign(body)}`, expiresIn: config.POS_TOKEN_TTL_SECONDS, mode };
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

export function verifyPosToken(token: string): { memberId: string; mode: PosMode } {
  const [body, sig] = (token ?? '').split('.');
  if (!body || !sig) throw unauthorized('malformed pos token');
  if (!sigMatches(sig, sign(body))) throw unauthorized('bad pos signature');
  let payload: PosTokenPayload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { throw unauthorized('bad pos token'); }
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp < nowSec) throw unauthorized('pos token expired');
  for (const [jti, exp] of usedJti) if (exp < nowSec) usedJti.delete(jti);
  if (usedJti.has(payload.jti)) throw conflict('pos_token_replay', 'pos token already used');
  usedJti.set(payload.jti, payload.exp);
  // A token minted before `mode` existed is read as 'pay' — the same default
  // the mint uses, and the same thing the old barcode said when the member had
  // not touched the toggle. An unknown value is NOT coerced silently to 'pay':
  // it is the signature holder's own word for what the member asked for, so a
  // value this build cannot name is a refusal, not a guess.
  const mode = payload.mode ?? 'pay';
  if (!POS_MODES.includes(mode)) throw unauthorized('unknown pos token mode');
  return { memberId: payload.sub, mode };
}
