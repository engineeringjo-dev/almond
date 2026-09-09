import 'server-only';
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * THE BACK-OFFICE'S SERVER SIDE — the session, and the only place the BFF's
 * admin key exists.
 *
 * 🔴 WHAT THIS REPLACES. `store/adminAuth.ts` compared a password from
 * `NEXT_PUBLIC_ADMIN_PASS` — a `NEXT_PUBLIC_*` variable, so it shipped inside
 * the browser bundle — defaulting to the literal `'almond'`, and then persisted
 * `authed: true` to `localStorage`. Anyone could read the password out of the
 * bundle, and anyone who could not be bothered could write the localStorage key
 * by hand. It guarded a menu editor that only wrote to the same browser, so
 * nothing was lost; it cannot be what stands in front of the corporate register,
 * which decides who pays half price.
 *
 * TWO SECRETS, BOTH SERVER-ONLY, FOLLOWING THE ISHBEK PATTERN ALREADY IN THIS
 * REPO (server/ishbek.ts):
 *   ADMIN_PASSWORD — what a person types.
 *   ADMIN_KEY      — what the BFF requires. NEVER leaves this process; the
 *                    browser calls our route handlers, and they call the BFF.
 *
 * That indirection is not ceremony. A key in the browser is a key in every
 * browser that ever opened the page.
 */

const SESSION_COOKIE = 'almond_admin';
const SESSION_TTL_SECONDS = 8 * 60 * 60;   // one working day, then type it again

function secret(name: 'ADMIN_PASSWORD' | 'ADMIN_KEY' | 'ADMIN_SESSION_SECRET'): string {
  return process.env[name] ?? '';
}

/** Constant-time compare — `!==` on a secret leaks its prefix through timing. */
function matches(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * The signing secret for the session cookie.
 *
 * Falls back to a RANDOM value generated at boot when unset, rather than to a
 * fixed default. A fixed default would let anyone who read this file mint a
 * valid admin session; a random one means sessions simply do not survive a
 * restart, which is an inconvenience rather than a hole. That is the same trade
 * the BFF makes, and the reason `OTP_DEV_CODE = '123456'` is a cautionary tale
 * in this repo rather than a pattern.
 */
const SIGNING_KEY = secret('ADMIN_SESSION_SECRET') || randomBytes(32).toString('hex');

function sign(payload: string): string {
  return createHmac('sha256', SIGNING_KEY).update(payload).digest('base64url');
}

/** `configured` is false when ADMIN_PASSWORD is unset — the login refuses
 *  rather than accepting anything, and the screen says why. */
export function adminConfigured(): boolean {
  return secret('ADMIN_PASSWORD').length > 0 && secret('ADMIN_KEY').length > 0;
}

export async function signInAdmin(password: string): Promise<boolean> {
  // FAILS CLOSED: with no password configured there is nothing to match, so
  // every attempt is refused. An unconfigured back-office is a locked one.
  if (!adminConfigured() || !matches(password, secret('ADMIN_PASSWORD'))) return false;

  const expires = Date.now() + SESSION_TTL_SECONDS * 1000;
  const body = String(expires);
  (await cookies()).set(SESSION_COOKIE, `${body}.${sign(body)}`, {
    httpOnly: true,           // unreadable from JavaScript, unlike localStorage
    sameSite: 'strict',       // not sent on a cross-site request
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return true;
}

export async function signOutAdmin(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Is the caller a signed-in administrator? Verifies the signature AND the
 *  expiry — an unexpired signature on a stale body would be a session that
 *  never ends. */
export async function isAdmin(): Promise<boolean> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return false;
  const dot = raw.lastIndexOf('.');
  if (dot < 1) return false;
  const body = raw.slice(0, dot);
  if (!matches(raw.slice(dot + 1), sign(body))) return false;
  const expires = Number(body);
  return Number.isFinite(expires) && expires > Date.now();
}

export class AdminError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

/**
 * Call the BFF as the administrator.
 *
 * 🔴 EVERY CALLER MUST HAVE CHECKED `isAdmin()` FIRST. This function attaches
 * the admin key; it does not decide who may use it. The check lives in the
 * route handlers so that a new handler cannot get the key by importing this
 * without also thinking about the session.
 */
export async function bff<T>(
  path: string,
  init: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown } = {},
): Promise<T> {
  const base = process.env.BFF_BASE_URL;
  if (!base) throw new AdminError(503, 'BFF_BASE_URL is not set — the back-office has no server to talk to');

  const res = await fetch(`${base}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'x-admin-key': secret('ADMIN_KEY'),
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    cache: 'no-store',
  });

  const text = await res.text();
  if (!res.ok) {
    // Pass the BFF's own message through — "a discount over 100% would owe the
    // customer money" is more use to an administrator than "502".
    let message = text;
    try { message = (JSON.parse(text) as { message?: string }).message ?? text; } catch { /* not json */ }
    throw new AdminError(res.status, message);
  }
  return (text ? JSON.parse(text) : null) as T;
}
