import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { POS_MODES, type PosMode } from '@almond/shared/pos/tokenWire';
import { config } from '../config';
import { HttpError, conflict } from '../http-error';

/**
 * WHICH 401 IS WHICH. Every till route answers 401 for a wrong POS key AND for
 * a bad member QR — and the till must tell them apart: a wrong key is a
 * misconfigured till (alert operations; nothing the cashier can do), a bad QR
 * is the member's (ask them to refresh the code). So the status stays 401 and
 * the machine code in the body differs:
 *
 *   pos_key_invalid   x-pos-key missing, wrong, or no key configured (routes/pos.ts)
 *   token_invalid     the member QR is malformed, mis-signed or of an unknown mode
 *   token_expired     the member QR is past its 60 s
 *   pos_token_replay  (409) the member QR was already scanned — unchanged
 *   ticket_invalid    the earn ticket was not signed by this server
 *   ticket_expired    the earn ticket is past its lifetime (and this is a NEW sale)
 *   ticket_used       (409) the earn ticket already paid for another POS order
 */
const tokenInvalid = (m: string) => new HttpError(401, 'token_invalid', m);

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
  if (!body || !sig) throw tokenInvalid('malformed pos token');
  if (!sigMatches(sig, sign(body))) throw tokenInvalid('bad pos signature');
  let payload: PosTokenPayload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { throw tokenInvalid('bad pos token'); }
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp < nowSec) throw new HttpError(401, 'token_expired', 'pos token expired');
  for (const [jti, exp] of usedJti) if (exp < nowSec) usedJti.delete(jti);
  if (usedJti.has(payload.jti)) throw conflict('pos_token_replay', 'pos token already used');
  usedJti.set(payload.jti, payload.exp);
  // A token minted before `mode` existed is read as 'pay' — the same default
  // the mint uses, and the same thing the old barcode said when the member had
  // not touched the toggle. An unknown value is NOT coerced silently to 'pay':
  // it is the signature holder's own word for what the member asked for, so a
  // value this build cannot name is a refusal, not a guess.
  const mode = payload.mode ?? 'pay';
  if (!POS_MODES.includes(mode)) throw tokenInvalid('unknown pos token mode');
  return { memberId: payload.sub, mode };
}

// ---------------------------------------------------------------------------
// THE EARN TICKET — what lets a till grant points, and to whom.
// ---------------------------------------------------------------------------

/**
 * A server-signed, single-use, short-lived ticket binding ONE member, handed
 * to the till by POST /v1/pos/scan and spent by POST /v1/pos/earn.
 *
 * 🔴 WHY THE TILL CANNOT JUST SEND A MEMBER ID. Every till shares one
 * POS_SCAN_KEY. If /v1/pos/earn took `memberId` from the body, anyone holding
 * that key — a till, a laptop that once configured one, a leaked .env — could
 * grant points to any member id they could read off a receipt or a screen, as
 * often as they liked. The ticket is proof that THIS member physically showed
 * THEIR QR at a counter a moment ago; the till can carry it but cannot make one.
 *
 * DOMAIN-SEPARATED from the QR token. Both are HMACs under POS_TOKEN_SECRET,
 * but the ticket's MAC covers a fixed prefix the QR's does not, and its payload
 * carries `typ: 'earn'`. So a QR cannot be presented as a ticket (it would buy
 * points with a code the member shows in public) and a ticket cannot be
 * presented as a QR (it would re-open a scan). Both directions are tested.
 *
 * SINGLE USE IS ENFORCED BY THE STORE, NOT HERE. The ticket id (`jti`) is
 * written on the pos_sales row it paid for, under a UNIQUE constraint — so it
 * holds across restarts and across instances, which the QR's in-process
 * `usedJti` map does not. This function only proves the ticket is ours and
 * says whether it has expired; `Backend.tillEarn` decides whether it is spent.
 */
const EARN_TICKET_DOMAIN = 'almond.pos.earn-ticket.v1\n';
const signEarnTicket = (body: string): string =>
  createHmac('sha256', config.POS_TOKEN_SECRET).update(EARN_TICKET_DOMAIN + body).digest('base64url');

interface EarnTicketPayload {
  typ: 'earn';
  sub: string;
  jti: string;
  /** Issued-at (seconds): the moment the member's QR was scanned. The sale the
   *  ticket pays for must have been paid around THIS moment, however late the
   *  till delivers the report (routes/pos.ts). */
  iat: number;
  exp: number;
}

/** What a verified ticket says. `expired` is reported, not thrown: a till that
 *  RETRIES an earn it already reported must get its stored answer back even
 *  after the ticket has lapsed (see routes/pos.ts). */
export interface EarnTicketClaim {
  memberId: string;
  jti: string;
  /** Seconds. */
  iat: number;
  exp: number;
  expired: boolean;
}

export function issueEarnTicket(memberId: string): { ticket: string; expiresIn: number } {
  const ttl = config.POS_EARN_TICKET_TTL_SECONDS;
  const iat = Math.floor(Date.now() / 1000);
  const payload: EarnTicketPayload = { typ: 'earn', sub: memberId, jti: randomUUID(), iat, exp: iat + ttl };
  const body = b64u(JSON.stringify(payload));
  return { ticket: `${body}.${signEarnTicket(body)}`, expiresIn: ttl };
}

/** Verify the signature and read the claim. Throws 401 `ticket_invalid` for
 *  anything we did not sign; never throws for expiry. */
export function readEarnTicket(ticket: string, nowMs: number = Date.now()): EarnTicketClaim {
  const invalid = () => new HttpError(401, 'ticket_invalid', 'this earn ticket was not issued by this server');
  const [body, sig, extra] = (ticket ?? '').split('.');
  if (!body || !sig || extra !== undefined) throw invalid();
  if (!sigMatches(sig, signEarnTicket(body))) throw invalid();
  let payload: Partial<EarnTicketPayload>;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as Partial<EarnTicketPayload>; } catch { throw invalid(); }
  if (payload.typ !== 'earn' || typeof payload.sub !== 'string' || !payload.sub
    || typeof payload.jti !== 'string' || !payload.jti
    || typeof payload.iat !== 'number' || typeof payload.exp !== 'number') {
    throw invalid();
  }
  return {
    memberId: payload.sub, jti: payload.jti, iat: payload.iat, exp: payload.exp,
    expired: payload.exp < Math.floor(nowMs / 1000),
  };
}
