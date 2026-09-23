import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Guards the back-office session (src/server/admin.ts) — the thing standing in
 * front of the corporate register — and the rule that ADMIN_KEY only ever goes
 * server → BFF, never back to the caller.
 *
 * The module reads ADMIN_SESSION_SECRET ONCE, at import, to build its signing
 * key. Every test therefore stubs the env and re-imports a fresh copy
 * (`loadAdmin`), which is also how "a different secret" and "a restart" are
 * simulated.
 */

type CookieOpts = Record<string, unknown>;
const jar = vi.hoisted(() => new Map<string, { value: string; opts?: Record<string, unknown> }>());

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, opts?: CookieOpts) => {
      jar.set(name, { value, opts });
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
}));

const COOKIE = 'almond_admin';
const T0 = new Date('2026-09-23T09:00:00.000Z');
const EIGHT_HOURS = 8 * 60 * 60 * 1000;

interface Env {
  ADMIN_PASSWORD?: string;
  ADMIN_KEY?: string;
  ADMIN_SESSION_SECRET?: string;
  BFF_BASE_URL?: string;
}

const CONFIGURED: Env = {
  ADMIN_PASSWORD: 'correct horse',
  ADMIN_KEY: 'bff-admin-key-DO-NOT-LEAK',
  ADMIN_SESSION_SECRET: 'session-secret-A',
  BFF_BASE_URL: 'https://bff.test',
};

async function loadAdmin(env: Env = CONFIGURED) {
  vi.resetModules();
  for (const k of ['ADMIN_PASSWORD', 'ADMIN_KEY', 'ADMIN_SESSION_SECRET', 'BFF_BASE_URL'] as const) {
    // stubEnv(undefined) deletes the variable for the duration of the test.
    vi.stubEnv(k, env[k]);
  }
  return import('@/server/admin');
}

function forge(body: string, key: string): string {
  return `${body}.${createHmac('sha256', key).update(body).digest('base64url')}`;
}

beforeEach(() => {
  jar.clear();
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('adminConfigured', () => {
  it('is true only when BOTH ADMIN_PASSWORD and ADMIN_KEY are set', async () => {
    expect((await loadAdmin()).adminConfigured()).toBe(true);
    expect((await loadAdmin({ ...CONFIGURED, ADMIN_PASSWORD: undefined })).adminConfigured()).toBe(false);
    expect((await loadAdmin({ ...CONFIGURED, ADMIN_KEY: undefined })).adminConfigured()).toBe(false);
    expect((await loadAdmin({ ...CONFIGURED, ADMIN_PASSWORD: '' })).adminConfigured()).toBe(false);
  });
});

describe('signInAdmin', () => {
  it('fails closed when unconfigured — even the empty password is refused', async () => {
    const admin = await loadAdmin({ ...CONFIGURED, ADMIN_PASSWORD: undefined });
    expect(await admin.signInAdmin('')).toBe(false);
    expect(await admin.signInAdmin('anything')).toBe(false);
    expect(jar.size).toBe(0);
  });

  it('refuses a wrong password (including a prefix of the right one) and sets no cookie', async () => {
    const admin = await loadAdmin();
    expect(await admin.signInAdmin('wrong')).toBe(false);
    expect(await admin.signInAdmin('correct')).toBe(false);
    expect(await admin.signInAdmin('correct horse ')).toBe(false);
    expect(jar.size).toBe(0);
  });

  it('accepts the right password and sets an httpOnly, strict, 8-hour, signed cookie', async () => {
    const admin = await loadAdmin();
    expect(await admin.signInAdmin('correct horse')).toBe(true);

    const c = jar.get(COOKIE);
    expect(c).toBeDefined();
    const expires = T0.getTime() + EIGHT_HOURS;
    // body = expiry ms, signature = HMAC-SHA256(ADMIN_SESSION_SECRET) base64url
    expect(c!.value).toBe(forge(String(expires), 'session-secret-A'));
    expect(c!.opts).toMatchObject({
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 8 * 60 * 60,
      secure: false, // NODE_ENV is 'test' here; 'production' flips it on
    });
  });

  it('never writes the password or the BFF key into the cookie', async () => {
    const admin = await loadAdmin();
    await admin.signInAdmin('correct horse');
    const serialised = JSON.stringify([...jar.entries()]);
    expect(serialised).not.toContain('correct horse');
    expect(serialised).not.toContain(CONFIGURED.ADMIN_KEY);
  });

  it('marks the cookie secure in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const admin = await loadAdmin();
    await admin.signInAdmin('correct horse');
    expect(jar.get(COOKIE)!.opts).toMatchObject({ secure: true });
  });
});

describe('isAdmin — the session check', () => {
  it('is false with no cookie', async () => {
    expect(await (await loadAdmin()).isAdmin()).toBe(false);
  });

  it('is true for a freshly issued session and false after signOutAdmin', async () => {
    const admin = await loadAdmin();
    await admin.signInAdmin('correct horse');
    expect(await admin.isAdmin()).toBe(true);
    await admin.signOutAdmin();
    expect(jar.has(COOKIE)).toBe(false);
    expect(await admin.isAdmin()).toBe(false);
  });

  it('rejects a cookie whose expiry was edited to extend the session (signature no longer matches)', async () => {
    const admin = await loadAdmin();
    await admin.signInAdmin('correct horse');
    const [, sig] = jar.get(COOKIE)!.value.split('.');
    const later = String(T0.getTime() + 365 * 24 * 3600 * 1000);
    jar.set(COOKIE, { value: `${later}.${sig}` });
    expect(await admin.isAdmin()).toBe(false);
  });

  it('rejects a cookie with a flipped signature character', async () => {
    const admin = await loadAdmin();
    await admin.signInAdmin('correct horse');
    const v = jar.get(COOKIE)!.value;
    const last = v.at(-1) === 'A' ? 'B' : 'A';
    jar.set(COOKIE, { value: v.slice(0, -1) + last });
    expect(await admin.isAdmin()).toBe(false);
  });

  it.each([
    ['empty', ''],
    ['no dot', '1790000000000'],
    ['leading dot', '.abc'],
    ['body only + dot', `${T0.getTime() + 1000}.`],
    ['the old localStorage flag', 'true'],
    ['a truncated signature', forge(String(T0.getTime() + 1000), 'session-secret-A').slice(0, -4)],
  ])('rejects a malformed cookie: %s', async (_label, value) => {
    const admin = await loadAdmin();
    jar.set(COOKIE, { value });
    expect(await admin.isAdmin()).toBe(false);
  });

  it('rejects a correctly-signed but non-numeric / non-finite body', async () => {
    const admin = await loadAdmin();
    for (const body of ['forever', 'Infinity', 'NaN', '1e400']) {
      jar.set(COOKIE, { value: forge(body, 'session-secret-A') });
      expect(await admin.isAdmin(), body).toBe(false);
    }
  });

  it('expires: valid 1 ms before the 8-hour mark, invalid at it and after', async () => {
    const admin = await loadAdmin();
    await admin.signInAdmin('correct horse');

    vi.setSystemTime(T0.getTime() + EIGHT_HOURS - 1);
    expect(await admin.isAdmin()).toBe(true);

    vi.setSystemTime(T0.getTime() + EIGHT_HOURS);
    expect(await admin.isAdmin()).toBe(false);

    vi.setSystemTime(T0.getTime() + EIGHT_HOURS + 60_000);
    expect(await admin.isAdmin()).toBe(false);
  });

  it('rejects an expired body even when it carries a VALID signature', async () => {
    const admin = await loadAdmin();
    jar.set(COOKIE, { value: forge(String(T0.getTime() - 1), 'session-secret-A') });
    expect(await admin.isAdmin()).toBe(false);
  });

  it('rejects a session signed with a different ADMIN_SESSION_SECRET', async () => {
    const a = await loadAdmin({ ...CONFIGURED, ADMIN_SESSION_SECRET: 'session-secret-A' });
    await a.signInAdmin('correct horse');
    const cookieFromA = jar.get(COOKIE)!.value;

    const b = await loadAdmin({ ...CONFIGURED, ADMIN_SESSION_SECRET: 'session-secret-B' });
    jar.set(COOKIE, { value: cookieFromA });
    expect(await b.isAdmin()).toBe(false);
  });

  it('survives a restart when ADMIN_SESSION_SECRET is set (same secret, fresh module)', async () => {
    const a = await loadAdmin();
    await a.signInAdmin('correct horse');
    const restarted = await loadAdmin();
    expect(await restarted.isAdmin()).toBe(true);
  });

  it('with ADMIN_SESSION_SECRET unset, uses a RANDOM key: no fixed default can mint a session', async () => {
    const env = { ...CONFIGURED, ADMIN_SESSION_SECRET: undefined };
    const a = await loadAdmin(env);
    await a.signInAdmin('correct horse');
    expect(await a.isAdmin()).toBe(true);
    const cookie = jar.get(COOKIE)!.value;
    const body = cookie.split('.')[0];

    // An attacker guessing the obvious defaults cannot forge it...
    for (const guess of ['', 'almond', 'secret', 'undefined', CONFIGURED.ADMIN_PASSWORD!, CONFIGURED.ADMIN_KEY!]) {
      jar.set(COOKIE, { value: forge(body, guess) });
      expect(await a.isAdmin(), `guess=${JSON.stringify(guess)}`).toBe(false);
    }
    // ...and a restart (new random key) invalidates the old session.
    const restarted = await loadAdmin(env);
    jar.set(COOKIE, { value: cookie });
    expect(await restarted.isAdmin()).toBe(false);
  });
});

describe('bff() — the only place ADMIN_KEY is used', () => {
  function mockFetch(status: number, body: string) {
    const fn = vi.fn(async (_url: string, _init?: RequestInit) => new Response(body, { status }));
    vi.stubGlobal('fetch', fn);
    return fn;
  }

  it('refuses with 503 and makes no request when BFF_BASE_URL is unset', async () => {
    const admin = await loadAdmin({ ...CONFIGURED, BFF_BASE_URL: undefined });
    const fetchFn = mockFetch(200, '{}');
    await expect(admin.bff('/v1/admin/companies')).rejects.toMatchObject({ status: 503 });
    await expect(admin.bff('/v1/admin/companies')).rejects.toBeInstanceOf(admin.AdminError);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('GET: sends x-admin-key server-side, no body, no content-type, no-store', async () => {
    const admin = await loadAdmin();
    const fetchFn = mockFetch(200, JSON.stringify([{ id: 'c1' }]));
    const out = await admin.bff<unknown[]>('/v1/admin/companies');

    expect(out).toEqual([{ id: 'c1' }]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://bff.test/v1/admin/companies');
    expect(init).toMatchObject({ method: 'GET', cache: 'no-store' });
    expect(init!.headers).toEqual({ 'x-admin-key': CONFIGURED.ADMIN_KEY });
    expect(init).not.toHaveProperty('body');
  });

  it('PUT: JSON-encodes the body and sets content-type', async () => {
    const admin = await loadAdmin();
    const fetchFn = mockFetch(200, '{"ok":true}');
    await admin.bff('/v1/admin/companies', { method: 'PUT', body: { name: 'Acme', discount: 0.5 } });
    const [, init] = fetchFn.mock.calls[0];
    expect(init).toMatchObject({ method: 'PUT', body: '{"name":"Acme","discount":0.5}' });
    expect(init!.headers).toEqual({
      'x-admin-key': CONFIGURED.ADMIN_KEY,
      'content-type': 'application/json',
    });
  });

  it('returns null for an empty 2xx body', async () => {
    const admin = await loadAdmin();
    mockFetch(200, '');
    expect(await admin.bff('/x')).toBeNull();
  });

  it("passes the BFF's JSON `message` through with the BFF's status", async () => {
    const admin = await loadAdmin();
    mockFetch(422, JSON.stringify({ message: 'a discount over 100% would owe the customer money' }));
    await expect(admin.bff('/x')).rejects.toMatchObject({
      status: 422,
      message: 'a discount over 100% would owe the customer money',
    });
  });

  it('falls back to the raw text for a non-JSON error body', async () => {
    const admin = await loadAdmin();
    mockFetch(502, 'Bad Gateway');
    await expect(admin.bff('/x')).rejects.toMatchObject({ status: 502, message: 'Bad Gateway' });
  });

  it('never puts ADMIN_KEY into a result or an error it hands back', async () => {
    const admin = await loadAdmin();
    mockFetch(200, '{"companies":[]}');
    expect(JSON.stringify(await admin.bff('/x'))).not.toContain(CONFIGURED.ADMIN_KEY);

    mockFetch(401, '{"message":"bad admin key"}');
    const err = await admin.bff('/x').catch((e: unknown) => e as Error);
    expect(String((err as Error).message)).not.toContain(CONFIGURED.ADMIN_KEY);
    expect(JSON.stringify(err)).not.toContain(CONFIGURED.ADMIN_KEY);
  });
});
