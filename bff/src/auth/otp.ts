import { randomInt, timingSafeEqual } from 'node:crypto';
import { config } from '../config';
import { badRequest, unauthorized, tooManyRequests } from '../http-error';

/** Normalize any Jordanian phone entry to canonical +9627XXXXXXXX. */
export function normalizePhone(raw: string): string {
  let d = (raw ?? '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, '');
  if (d.startsWith('962')) d = d.slice(3);
  d = d.replace(/^0/, '');
  if (!/^7\d{8}$/.test(d)) throw badRequest('invalid Jordan phone number');
  return `+962${d}`;
}

/**
 * Phone verification — the ONLY thing standing between a phone number and an
 * account that holds money. docs/LOYALTY-ODOO-ARCHITECTURE.md §G gate 0.
 *
 * What was here before: `requestOtp` stored the constant `config.OTP_DEV_CODE`
 * (defaulting to '123456'), and `verifyOtp` accepted that constant for ANY
 * phone whether or not a code had ever been requested. It was a master password
 * for all 47,720 members, on by default. 586 accounts hold >= 10 JOD.
 *
 * Three things replace it, and all three are load-bearing:
 *   1. a cryptographically random code per request, never returned over HTTP;
 *   2. an ATTEMPT CAP — 6 digits with unlimited guesses is 10^6 requests, so
 *      deleting the constant without this would move the hole, not close it;
 *   3. a SEND cap, so the cap in (2) cannot be reset by re-requesting.
 *
 * In-process state, like the rest of the memory backend. A second BFF instance
 * gets its own map: correct but not shared, so both caps are per-instance.
 * Moving to Redis is the same change `bff/src/pos/token.ts` needs for `usedJti`
 * and belongs with it, not before it.
 */
interface Pending {
  code: string;
  exp: number;
  /** Wrong guesses so far against THIS code. */
  attempts: number;
}

const pending = new Map<string, Pending>();
/** Send timestamps per phone, for the resend cooldown and the hourly cap. */
const sends = new Map<string, number[]>();

/** Constant-time compare that does not leak the code's length either. */
function codesMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function sweep(now: number): void {
  for (const [phone, rec] of pending) if (rec.exp <= now) pending.delete(phone);
  for (const [phone, ts] of sends) {
    const live = ts.filter((t) => now - t < 3600_000);
    if (live.length === 0) sends.delete(phone);
    else sends.set(phone, live);
  }
}

/**
 * Issue a code. The code is returned to the CALLER (the route) so that a
 * non-production deployment can log it — it is never put in the HTTP response.
 * See routes/auth.ts, which is the only caller and drops it in production.
 */
export function requestOtp(phone: string): { sent: true; code: string } {
  const now = Date.now();
  sweep(now);

  const recent = sends.get(phone) ?? [];
  const last = recent[recent.length - 1];
  if (last != null && now - last < config.OTP_RESEND_COOLDOWN_SECONDS * 1000) {
    throw tooManyRequests('otp_cooldown', 'a code was just sent — wait before requesting another');
  }
  if (recent.length >= config.OTP_MAX_SENDS_PER_HOUR) {
    throw tooManyRequests('otp_send_limit', 'too many verification codes requested for this number');
  }
  sends.set(phone, [...recent, now]);

  // randomInt is CSPRNG-backed and unbiased over the range; Math.random is not.
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  pending.set(phone, { code, exp: now + config.OTP_TTL_SECONDS * 1000, attempts: 0 });
  return { sent: true, code };
}

export function verifyOtp(phone: string, code: string): void {
  const now = Date.now();
  sweep(now);
  const rec = pending.get(phone);

  // No code was requested for this phone. There is no longer any value of
  // `code` that succeeds here — that is the whole point of gate 0.
  if (!rec || rec.exp <= now) throw unauthorized('invalid or expired verification code');

  if (!codesMatch(rec.code, code ?? '')) {
    rec.attempts += 1;
    // Burn the code once the budget is spent. The member re-requests (which the
    // send cap then bounds), so a guesser gets OTP_MAX_ATTEMPTS tries per send
    // and OTP_MAX_SENDS_PER_HOUR sends: 25 guesses/hour against 10^6.
    if (rec.attempts >= config.OTP_MAX_ATTEMPTS) pending.delete(phone);
    throw unauthorized('invalid or expired verification code');
  }

  pending.delete(phone); // single use
}

/** Test-only: drop all in-memory verification state. */
export function __resetOtpState(): void {
  pending.clear();
  sends.clear();
}
