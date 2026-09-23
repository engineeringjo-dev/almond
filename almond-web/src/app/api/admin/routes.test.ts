import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Guards the back-office route handlers under /api/admin/**:
 *   - /api/admin/session: login refuses when unconfigured (503) / wrong (401);
 *   - every BFF proxy route refuses without a session and DOES NOT call the BFF
 *     (so the admin key never leaves the process for an anonymous caller);
 *   - with a session, the reply to the browser never contains ADMIN_KEY.
 */

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
}));

const KEY = 'bff-admin-key-DO-NOT-LEAK';
const PASSWORD = 'correct horse';

function configure(overrides: Record<string, string | undefined> = {}) {
  vi.resetModules();
  const env: Record<string, string | undefined> = {
    ADMIN_PASSWORD: PASSWORD,
    ADMIN_KEY: KEY,
    ADMIN_SESSION_SECRET: 'route-test-secret',
    BFF_BASE_URL: 'https://bff.test',
    ...overrides,
  };
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
}

function post(body: unknown, raw?: string): Request {
  return new Request('https://almond.test/api/admin/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw ?? JSON.stringify(body),
  });
}

async function signIn() {
  const session = await import('./session/route');
  const res = await session.POST(post({ password: PASSWORD }));
  expect(res.status).toBe(200);
}

let fetchFn: ReturnType<typeof vi.fn>;
beforeEach(() => {
  jar.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-23T09:00:00.000Z'));
  fetchFn = vi.fn(async () => new Response(JSON.stringify({ companies: [{ id: 'acme' }] }), { status: 200 }));
  vi.stubGlobal('fetch', fetchFn);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('/api/admin/session', () => {
  it('GET reports unauthenticated + configured', async () => {
    configure();
    const { GET } = await import('./session/route');
    expect(await (await GET()).json()).toEqual({ authed: false, configured: true });
  });

  it('POST returns 503 naming the missing settings when unconfigured', async () => {
    configure({ ADMIN_KEY: undefined });
    const { POST } = await import('./session/route');
    const res = await POST(post({ password: PASSWORD }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/ADMIN_PASSWORD and ADMIN_KEY/);
    expect(jar.size).toBe(0);
  });

  it('POST returns 401 for a wrong or missing password', async () => {
    configure();
    const { POST } = await import('./session/route');
    expect((await POST(post({ password: 'nope' }))).status).toBe(401);
    expect((await POST(post({}))).status).toBe(401);
    expect(jar.size).toBe(0);
  });

  it('POST signs in, and neither the reply nor its headers carry the password or the key', async () => {
    configure();
    const { POST, GET } = await import('./session/route');
    const res = await POST(post({ password: PASSWORD }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ authed: true });
    const everything = text + JSON.stringify([...res.headers.entries()]);
    expect(everything).not.toContain(KEY);
    expect(everything).not.toContain(PASSWORD);
    expect(await (await GET()).json()).toEqual({ authed: true, configured: true });
  });

  it('DELETE signs out', async () => {
    configure();
    await signIn();
    const { DELETE, GET } = await import('./session/route');
    expect(await (await DELETE()).json()).toEqual({ authed: false });
    expect(await (await GET()).json()).toMatchObject({ authed: false });
  });

  // Was a bug (500 on garbage) when this suite was written; fixed in
  // session/route.ts — kept as a regression guard.
  it('POST with a malformed JSON body answers 400, not an unhandled throw', async () => {
    configure();
    const { POST } = await import('./session/route');
    const res = await POST(post(undefined, '{not json'));
    expect(res.status).toBe(400);
  });

  it('a non-string password is refused (401), never coerced', async () => {
    configure();
    const { POST } = await import('./session/route');
    expect((await POST(post({ password: ['correct horse'] }))).status).toBe(401);
    expect((await POST(post({ password: { toString: 'correct horse' } }))).status).toBe(401);
    expect(jar.size).toBe(0);
  });

  describe('login throttle', () => {
    const from = (ip: string, password: string) =>
      new Request('https://almond.test/api/admin/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-real-ip': ip },
        body: JSON.stringify({ password }),
      });

    it('after N wrong passwords from one client, even the RIGHT one gets 429 (no oracle)', async () => {
      configure({ ADMIN_LOGIN_MAX_FAILURES: '3', ADMIN_LOGIN_MAX_FAILURES_TOTAL: '100' });
      const { POST } = await import('./session/route');
      for (let i = 0; i < 3; i++) expect((await POST(from('1.1.1.1', 'nope'))).status).toBe(401);
      const locked = await POST(from('1.1.1.1', PASSWORD));
      expect(locked.status).toBe(429);
      expect(locked.headers.get('retry-after')).toBe('900');
      expect(jar.size).toBe(0);
      // Another client is unaffected by this one's failures.
      expect((await POST(from('2.2.2.2', PASSWORD))).status).toBe(200);
    });

    it('the window expires after 15 minutes', async () => {
      configure({ ADMIN_LOGIN_MAX_FAILURES: '2', ADMIN_LOGIN_MAX_FAILURES_TOTAL: '100' });
      const { POST } = await import('./session/route');
      await POST(from('1.1.1.1', 'nope'));
      await POST(from('1.1.1.1', 'nope'));
      expect((await POST(from('1.1.1.1', PASSWORD))).status).toBe(429);
      vi.setSystemTime(Date.now() + 15 * 60 * 1000 + 1);
      expect((await POST(from('1.1.1.1', PASSWORD))).status).toBe(200);
    });

    it('the TOTAL cap across clients closes the login for everyone', async () => {
      configure({ ADMIN_LOGIN_MAX_FAILURES: '100', ADMIN_LOGIN_MAX_FAILURES_TOTAL: '3' });
      const { POST } = await import('./session/route');
      for (const ip of ['1.0.0.1', '1.0.0.2', '1.0.0.3']) await POST(from(ip, 'nope'));
      expect((await POST(from('9.9.9.9', PASSWORD))).status).toBe(429);
    });

    it('successful logins do not count toward the limit', async () => {
      configure({ ADMIN_LOGIN_MAX_FAILURES: '2', ADMIN_LOGIN_MAX_FAILURES_TOTAL: '2' });
      const { POST } = await import('./session/route');
      for (let i = 0; i < 5; i++) expect((await POST(from('1.1.1.1', PASSWORD))).status).toBe(200);
    });
  });
});

describe('BFF proxy routes refuse without a session and never call the BFF', () => {
  const ctx = { params: Promise.resolve({ id: 'acme' }) };
  const cases: Array<[string, () => Promise<Response>]> = [
    ['GET /api/admin/companies', async () => (await import('./companies/route')).GET()],
    [
      'PUT /api/admin/companies',
      async () =>
        (await import('./companies/route')).PUT(
          new Request('https://almond.test/api/admin/companies', { method: 'PUT', body: '{}' }),
        ),
    ],
    [
      'GET /api/admin/companies/[id]/roster',
      async () =>
        (await import('./companies/[id]/roster/route')).GET(new Request('https://almond.test/x'), ctx),
    ],
    [
      'PUT /api/admin/companies/[id]/roster',
      async () =>
        (await import('./companies/[id]/roster/route')).PUT(
          new Request('https://almond.test/x', { method: 'PUT', body: '{"rows":[]}' }),
          ctx,
        ),
    ],
    [
      'GET /api/admin/corporate/uses',
      async () =>
        (await import('./corporate/uses/route')).GET(new Request('https://almond.test/api/admin/corporate/uses?company=acme')),
    ],
  ];

  it.each(cases)('%s → 401, fetch not called', async (_name, call) => {
    configure();
    const res = await call();
    expect(res.status).toBe(401);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('a forged/stale cookie is still 401 and still no BFF call', async () => {
    configure();
    jar.set('almond_admin', `${Date.now() + 3_600_000}.forged`);
    const res = await (await import('./companies/route')).GET();
    expect(res.status).toBe(401);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('BFF proxy routes with a session', () => {
  it('GET /api/admin/companies proxies with the key and returns the data without it', async () => {
    configure();
    await signIn();
    const res = await (await import('./companies/route')).GET();
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ companies: [{ id: 'acme' }] });
    expect(text + JSON.stringify([...res.headers.entries()])).not.toContain(KEY);

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://bff.test/v1/admin/companies');
    expect((init.headers as Record<string, string>)['x-admin-key']).toBe(KEY);
  });

  it('roster route URL-encodes the company id (no path traversal into other BFF routes)', async () => {
    configure();
    await signIn();
    const { GET } = await import('./companies/[id]/roster/route');
    await GET(new Request('https://almond.test/x'), { params: Promise.resolve({ id: '../../users' }) });
    expect(fetchFn.mock.calls[0][0]).toBe('https://bff.test/v1/admin/companies/..%2F..%2Fusers/roster');
  });

  it('corporate/uses forwards the query string verbatim', async () => {
    configure();
    await signIn();
    const { GET } = await import('./corporate/uses/route');
    await GET(new Request('https://almond.test/api/admin/corporate/uses?company=acme&from=2026-09-01'));
    expect(fetchFn.mock.calls[0][0]).toBe('https://bff.test/v1/admin/corporate/uses?company=acme&from=2026-09-01');
  });

  it("passes the BFF's status and message through", async () => {
    configure();
    await signIn();
    fetchFn.mockResolvedValueOnce(new Response('{"message":"discount must be ≤ 100%"}', { status: 422 }));
    const res = await (await import('./companies/route')).PUT(
      new Request('https://almond.test/x', { method: 'PUT', body: '{"discount":2}' }),
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'discount must be ≤ 100%' });
  });

  it('a network failure (not an AdminError) becomes 502', async () => {
    configure();
    await signIn();
    fetchFn.mockRejectedValueOnce(new TypeError('fetch failed'));
    const res = await (await import('./companies/route')).GET();
    expect(res.status).toBe(502);
  });

  it('BFF_BASE_URL unset → 503, and no request leaves the process', async () => {
    configure({ BFF_BASE_URL: undefined });
    await signIn();
    const res = await (await import('./companies/route')).GET();
    expect(res.status).toBe(503);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
