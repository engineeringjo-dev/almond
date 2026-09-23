import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';

/**
 * W1–W4 — almond-web's server side, tested from here because this review may
 * only add test files under bff/test. The REAL route handlers are imported and
 * called with a real `Request`; only their `@/server/*` collaborators are
 * mocked (the web alias is not resolvable from this workspace, and mocking
 * those two modules is also exactly the seam each test needs).
 *
 * The specifiers are variables so `tsc` in this workspace does not try to
 * type-resolve the web app's `@/` imports; almond-web's own typecheck and
 * `next build` cover those files.
 */

const WEB = path.resolve(__dirname, '../../almond-web');
const load = <T>(rel: string): Promise<T> => import(/* @vite-ignore */ path.join(WEB, rel)) as Promise<T>;

type Handler = (req: Request, ctx?: unknown) => Promise<Response>;

const state = vi.hoisted(() => ({
  live: false,
  admin: false,
  calls: [] as string[],
}));

vi.mock('@/server/ishbek', () => ({
  isLive: () => state.live,
  ishbekDispatch: async () => { state.calls.push('dispatch'); return { id: 'd1', fleet: 'careem', status: 'assigned', etaMinutes: 35 }; },
  ishbekCancel: async () => { state.calls.push('cancel'); return { status: 'cancelled' }; },
  ishbekStatus: async () => { state.calls.push('status'); return { status: 'assigned' }; },
}));

vi.mock('@/server/admin', () => ({
  isAdmin: async () => state.admin,
  adminConfigured: () => true,
  signInAdmin: async (pw: string) => pw === 'the-right-password',
  signOutAdmin: async () => {},
}));

beforeEach(() => { state.live = false; state.admin = false; state.calls = []; vi.resetModules(); });
afterEach(() => { vi.unstubAllEnvs(); });

// ---------------------------------------------------------------------------
describe('W1 live delivery calls spend the Ishbek key only for staff', () => {
  const post = (url: string, body: unknown) =>
    new Request(`https://almond.test${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  it('🔴 an anonymous caller cannot dispatch a live captain (was: 200 and a real dispatch)', async () => {
    state.live = true;
    const { POST } = await load<{ POST: Handler }>('src/app/api/delivery/dispatch/route.ts');
    const r = await POST(post('/api/delivery/dispatch', { order: { id: 'forged', branchId: 'b1', items: [] } }));
    expect(r.status).toBe(401);
    expect(state.calls).toEqual([]);          // the key was never spent
  });

  it('🔴 an anonymous caller cannot cancel a live dispatch', async () => {
    state.live = true;
    const { POST } = await load<{ POST: Handler }>('src/app/api/delivery/cancel/route.ts');
    const r = await POST(post('/api/delivery/cancel', { dispatchId: 'someone-elses' }));
    expect(r.status).toBe(401);
    expect(state.calls).toEqual([]);
  });

  it('🔴 an anonymous caller cannot read a live dispatch status', async () => {
    state.live = true;
    const { GET } = await load<{ GET: Handler }>('src/app/api/delivery/status/[orderId]/route.ts');
    const r = await GET(new Request('https://almond.test/api/delivery/status/o1'), { params: Promise.resolve({ orderId: 'o1' }) });
    expect(r.status).toBe(401);
    expect(state.calls).toEqual([]);
  });

  it('a signed-in administrator can, and mock mode stays open for the demo', async () => {
    const { POST } = await load<{ POST: Handler }>('src/app/api/delivery/dispatch/route.ts');
    state.live = true; state.admin = true;
    expect((await POST(post('/api/delivery/dispatch', { order: { id: 'o1' } }))).status).toBe(200);
    state.live = false; state.admin = false;
    expect((await POST(post('/api/delivery/dispatch', { order: { id: 'o2' } }))).status).toBe(200);
    expect(state.calls).toEqual(['dispatch', 'dispatch']);
  });
});

// ---------------------------------------------------------------------------
describe('W2 the back-office login is throttled', () => {
  const login = (pw: string, ip: string) => new Request('https://almond.test/api/admin/session', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': ip }, body: JSON.stringify({ password: pw }),
  });

  it('🔴 one client cannot run a wordlist (was: unlimited attempts)', async () => {
    const { POST } = await load<{ POST: Handler }>('src/app/api/admin/session/route.ts');
    for (let i = 0; i < 10; i++) expect((await POST(login(`guess-${i}`, '203.0.113.1'))).status).toBe(401);
    // Spent: even the right password is refused from this client...
    const blocked = await POST(login('the-right-password', '203.0.113.1'));
    expect(blocked.status).toBe(429);
    // ...but not from the administrator's own machine.
    expect((await POST(login('the-right-password', '198.51.100.2'))).status).toBe(200);
  });

  it('🔴 many clients cannot share out the guessing either', async () => {
    vi.stubEnv('ADMIN_LOGIN_MAX_FAILURES_TOTAL', '5');
    const { POST } = await load<{ POST: Handler }>('src/app/api/admin/session/route.ts');
    for (let i = 0; i < 5; i++) expect((await POST(login('nope', `203.0.113.${10 + i}`))).status).toBe(401);
    expect((await POST(login('the-right-password', '198.51.100.3'))).status).toBe(429);
  });

  it('a malformed body is a 400, not an unhandled 500', async () => {
    const { POST } = await load<{ POST: Handler }>('src/app/api/admin/session/route.ts');
    const r = await POST(new Request('https://almond.test/api/admin/session', { method: 'POST', body: '{not json' }));
    expect(r.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
describe('W3 security headers on every response', () => {
  it('🔴 forbids framing and sniffing, and sets a referrer policy (there were no headers at all)', async () => {
    const mod = await load<{ default: { headers?: () => Promise<{ source: string; headers: { key: string; value: string }[] }[]> } }>('next.config.mjs');
    expect(typeof mod.default.headers, 'next.config must define headers()').toBe('function');
    const rules = await mod.default.headers!();
    const all = rules.find((r) => r.source === '/:path*');
    expect(all, 'one rule must cover every path, /admin and /api included').toBeDefined();
    const h = Object.fromEntries(all!.headers.map((x) => [x.key.toLowerCase(), x.value]));
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['content-security-policy']).toMatch(/frame-ancestors 'none'/);
    expect(h['content-security-policy']).toMatch(/object-src 'none'/);
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['content-security-policy-report-only']).toMatch(/default-src 'self'/);
  });
});

// ---------------------------------------------------------------------------
describe('W4 a live status read cannot steer our keyed request', () => {
  it('🔴 the order id is one encoded path segment (was: ../ and ?query reached Ishbek with X-Ishbek-Key)', async () => {
    vi.doMock('@/lib/config', () => ({ DATA_SOURCE: 'odoo' }));
    vi.stubEnv('ISHBEK_KEY', 'k');
    const seen: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (u: string) => { seen.push(u); return new Response('{"status":"assigned"}'); }));
    try {
      const { ishbekStatus } = await load<{ ishbekStatus: (id: string) => Promise<unknown> }>('src/server/ishbek.ts');
      await ishbekStatus('../../admin?x=1');
      const url = new URL(seen[0]);
      expect(url.pathname.startsWith('/delivery/status/')).toBe(true);
      expect(url.pathname.split('/').length).toBe(4);   // '', delivery, status, <one segment>
      expect(url.search).toBe('');
    } finally {
      vi.unstubAllGlobals();
      vi.doUnmock('@/lib/config');
    }
  });
});
