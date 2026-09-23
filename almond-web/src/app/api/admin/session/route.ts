import { NextResponse } from 'next/server';
import { adminConfigured, signInAdmin, signOutAdmin, isAdmin } from '@/server/admin';

export const runtime = 'nodejs';

/**
 * 🔴 THE LOGIN HAD NO ATTEMPT LIMIT. One shared password stands in front of the
 * corporate register, and this handler compared it as often as anyone cared to
 * POST — a wordlist ran at network speed. Wrong passwords are now counted per
 * client AND in total, per 15 minutes:
 *
 *   per client — stops one source guessing;
 *   in total   — stops many sources guessing (the per-client key comes from a
 *                header, which only the Vercel edge makes trustworthy).
 *
 * The total cap means a determined attacker can hold the LOGIN shut. Sessions
 * already issued keep working, and a locked door is the right failure for the
 * register that decides who pays half price.
 *
 * In process, like the BFF's limits: per serverless instance, so a bound rather
 * than an exact count. It lives in this file because nothing else uses it.
 */
const WINDOW_MS = 15 * 60 * 1000;
const PER_CLIENT = positive(process.env.ADMIN_LOGIN_MAX_FAILURES, 10);
const TOTAL = positive(process.env.ADMIN_LOGIN_MAX_FAILURES_TOTAL, 100);
const TOTAL_KEY = '*';

const failures = new Map<string, { count: number; resetAt: number }>();

function positive(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Vercel's edge overwrites both headers with the real client address. */
function clientOf(req: Request): string {
  return req.headers.get('x-real-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
}

function spent(key: string, max: number, now: number): boolean {
  const w = failures.get(key);
  return !!w && w.resetAt > now && w.count >= max;
}

function fail(key: string, now: number): void {
  const w = failures.get(key);
  if (w && w.resetAt > now) w.count += 1;
  else failures.set(key, { count: 1, resetAt: now + WINDOW_MS });
}

/** Is there a live session, and is the back-office configured at all? */
export async function GET() {
  return NextResponse.json({ authed: await isAdmin(), configured: adminConfigured() });
}

export async function POST(req: Request) {
  const now = Date.now();
  const client = clientOf(req);
  // Checked BEFORE the password is compared: a throttled caller learns nothing,
  // not even whether this particular guess was right.
  if (spent(client, PER_CLIENT, now) || spent(TOTAL_KEY, TOTAL, now)) {
    return NextResponse.json(
      { error: 'too many attempts — try again later' },
      { status: 429, headers: { 'retry-after': String(WINDOW_MS / 1000) } },
    );
  }

  let password: unknown;
  try {
    ({ password } = (await req.json()) as { password?: unknown });
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!adminConfigured()) {
    // Says WHICH setting is missing, because the alternative is an
    // administrator retyping a correct password against a server that could
    // never have accepted it.
    return NextResponse.json(
      { error: 'ADMIN_PASSWORD and ADMIN_KEY must be set on the server' },
      { status: 503 },
    );
  }
  if (!(await signInAdmin(typeof password === 'string' ? password : ''))) {
    fail(client, now);
    fail(TOTAL_KEY, now);
    return NextResponse.json({ error: 'wrong password' }, { status: 401 });
  }
  return NextResponse.json({ authed: true });
}

export async function DELETE() {
  await signOutAdmin();
  return NextResponse.json({ authed: false });
}
