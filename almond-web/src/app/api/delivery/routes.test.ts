import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Guards the outbound delivery routes (/api/delivery/{quote,dispatch,cancel,
 * status}) — the browser's only path to Ishbek:
 *   - input validation (400) and mock replies under the default data source;
 *   - LIVE mode: dispatch / cancel / status spend Almond's Ishbek key, so an
 *     anonymous caller gets 401 and NO request leaves the process; with an
 *     admin session they go through;
 *   - an upstream failure is a 502 whose body does not contain the key;
 *   - the status order id is URL-encoded (no path/query injection).
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

const ISHBEK_KEY = 'ishbek-key-DO-NOT-LEAK';

async function load(env: { source?: string; key?: string } = {}) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_DATA_SOURCE', env.source);
  vi.stubEnv('ISHBEK_KEY', env.key);
  vi.stubEnv('ADMIN_PASSWORD', 'pw');
  vi.stubEnv('ADMIN_KEY', 'admin-key');
  vi.stubEnv('ADMIN_SESSION_SECRET', 'delivery-test-secret');
  return {
    quote: await import('./quote/route'),
    dispatch: await import('./dispatch/route'),
    cancel: await import('./cancel/route'),
    status: await import('./status/[orderId]/route'),
    admin: await import('@/server/admin'),
  };
}

const post = (body: unknown) =>
  new Request('https://almond.test/api/delivery/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const statusCtx = (orderId: string) => ({ params: Promise.resolve({ orderId }) });
const ORDER = { order: { id: 'o1', items: [] } };

beforeEach(() => jar.clear());

describe('input validation (mock)', () => {
  it('dispatch without an order id → 400', async () => {
    const r = await load();
    expect((await r.dispatch.POST(post({}))).status).toBe(400);
    expect((await r.dispatch.POST(post({ order: {} }))).status).toBe(400);
  });

  it('cancel without a dispatchId → 400', async () => {
    const r = await load();
    expect((await r.cancel.POST(post({ orderId: 'o' }))).status).toBe(400);
  });

  it('malformed JSON is answered with an error status, not thrown', async () => {
    const r = await load();
    for (const route of [r.quote, r.dispatch, r.cancel]) {
      const res = await route.POST(post('{nope'));
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });
});

describe('mock data source', () => {
  it('quote / dispatch / cancel / status answer locally with no session and no request', async () => {
    const fetchFn = vi.fn();
    vi.stubGlobal('fetch', fetchFn);
    const r = await load({ key: ISHBEK_KEY }); // a key alone does not make it live
    expect(await (await r.quote.POST(post({}))).json()).toEqual({ fee: 1.5, etaMinutes: 35 });
    expect(await (await r.dispatch.POST(post(ORDER))).json()).toMatchObject({ id: 'disp_o1', status: 'assigned' });
    expect(await (await r.cancel.POST(post({ dispatchId: 'd', orderId: 'o' }))).json()).toEqual({ status: 'cancelled' });
    expect(await (await r.status.GET(new Request('https://almond.test/x'), statusCtx('o1'))).json()).toEqual({
      status: 'assigned',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('live data source', () => {
  const ok = () =>
    vi.fn(async (_u: string, _i?: RequestInit) =>
      new Response(JSON.stringify({ dispatchId: 'D', fleet: 'careem', status: 'assigned' }), { status: 200 }),
    );

  it.each([
    ['dispatch', (r: Awaited<ReturnType<typeof load>>) => r.dispatch.POST(post(ORDER))],
    ['cancel', (r: Awaited<ReturnType<typeof load>>) => r.cancel.POST(post({ dispatchId: 'd', orderId: 'o' }))],
    ['status', (r: Awaited<ReturnType<typeof load>>) => r.status.GET(new Request('https://almond.test/x'), statusCtx('o1'))],
  ])('%s without an admin session → 401 and the key is never spent', async (_n, call) => {
    const fetchFn = ok();
    vi.stubGlobal('fetch', fetchFn);
    const r = await load({ source: 'odoo', key: ISHBEK_KEY });
    expect((await call(r)).status).toBe(401);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('dispatch WITH an admin session reaches Ishbek with the key', async () => {
    const fetchFn = ok();
    vi.stubGlobal('fetch', fetchFn);
    const r = await load({ source: 'odoo', key: ISHBEK_KEY });
    expect(await r.admin.signInAdmin('pw')).toBe(true);
    const res = await r.dispatch.POST(post(ORDER));
    expect(res.status).toBe(200);
    expect((fetchFn.mock.calls[0][1]!.headers as Record<string, string>)['X-Ishbek-Key']).toBe(ISHBEK_KEY);
    expect(await res.text()).not.toContain(ISHBEK_KEY);
  });

  it('an upstream failure becomes 502 and the reply does not contain the Ishbek key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 500 })));
    const r = await load({ source: 'odoo', key: ISHBEK_KEY });
    const res = await r.quote.POST(post({}));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain(ISHBEK_KEY);
  });

  it('status URL-encodes the order id (no path/query injection with our key)', async () => {
    const fetchFn = vi.fn(async (_u: string, _i?: RequestInit) => new Response('{"status":"on_the_way"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchFn);
    const r = await load({ source: 'odoo', key: ISHBEK_KEY });
    await r.admin.signInAdmin('pw');
    const res = await r.status.GET(new Request('https://almond.test/x'), statusCtx('../../admin?x=1'));
    expect(res.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const url = new URL(fetchFn.mock.calls[0][0]);
    expect(url.pathname.startsWith('/delivery/status/')).toBe(true);
    expect(url.search).toBe('');
  });
});
