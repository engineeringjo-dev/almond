import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID, createHmac } from 'node:crypto';
import { menuItems } from '@almond/shared/menu';
import { config, insecureBootReasons } from '../src/config';
import { build } from '../src/server';
import { createMemoryBackend } from '../src/backend/memory';
import type { Backend } from '../src/backend';
import { requestOtp, normalizePhone, __resetOtpState } from '../src/auth/otp';
import { __resetRateLimits } from '../src/plugins/rateLimit';
import { signIn } from './lib/signIn';

/**
 * S13–S19 — the pre-handover security review (2026-09-23).
 *
 * Every describe here names a hole that was OPEN in the code under review and
 * the request that exploited it, except S17 (JWT), which records evidence that
 * a suspected hole is not one. Each guard was broken on purpose after its test
 * was written, and the test went red; see the review report.
 */

type Mutable = Record<string, unknown>;
const cfg = config as unknown as Mutable;
const saved = { NODE_ENV: config.NODE_ENV, DATABASE_URL: config.DATABASE_URL };
const restoreConfig = () => { cfg.NODE_ENV = saved.NODE_ENV; cfg.DATABASE_URL = saved.DATABASE_URL; };
/** The server is BUILT under the test env (dev secrets would refuse to boot in
 *  production) and then RUN as production: the money gates read config per
 *  request, which is also how a real deploy sees them. */
const asProduction = () => { cfg.NODE_ENV = 'production'; };

let phoneSeq = 0;
const freshPhone = () => `079${String(8_000_000 + phoneSeq++).padStart(7, '0')}`;

const ITEM = menuItems.find((m) => m.inStock !== false)!;
const line = (qty: number) => ({ itemId: ITEM.id, sizeId: ITEM.sizes[0].id, optionIds: [], qty });

/** The member id a JWT names — read, not trusted; the server verified it. */
const subOf = (token: string) =>
  (JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as { sub: string }).sub;

function headers(token: string, extra: Record<string, string> = {}) {
  return { authorization: `Bearer ${token}`, 'idempotency-key': randomUUID(), ...extra };
}

beforeEach(() => { __resetRateLimits(); __resetOtpState(); });
afterEach(() => { restoreConfig(); });

// ---------------------------------------------------------------------------
// S13 — value created against a payment nobody took.
// ---------------------------------------------------------------------------
describe('S13 money is created only against money that moved', () => {
  let app: FastifyInstance;
  let backend: Backend;
  beforeAll(async () => { backend = createMemoryBackend(); app = await build(backend); });
  afterAll(async () => { await app.close(); });

  const wallet = async (token: string) =>
    (await app.inject({ method: 'GET', url: '/v1/me/wallet', headers: { authorization: `Bearer ${token}` } })).json().balance as number;

  it('🔴 production refuses an unfunded wallet top-up (was: credit whatever the body said)', async () => {
    // EXPLOIT (before): POST /v1/wallet/topup {"amount":5000} → 201,
    // walletBalance 5000, +120 bonus points. No payment reference of any kind.
    const token = await signIn(app, freshPhone());
    asProduction();
    const r = await app.inject({
      method: 'POST', url: '/v1/wallet/topup', headers: headers(token), payload: { amount: 5000 },
    });
    expect(r.statusCode).toBe(403);
    expect(r.json().error).toBe('payment_capture_required');
    expect(await wallet(token)).toBe(0);
  });

  it('a persistent store is real money even when NODE_ENV was forgotten', async () => {
    // Staging with a real DATABASE_URL and no NODE_ENV=production is still a
    // mint if the gate reads NODE_ENV alone.
    const token = await signIn(app, freshPhone());
    cfg.DATABASE_URL = 'postgres://staging.example/almond';
    const r = await app.inject({
      method: 'POST', url: '/v1/wallet/topup', headers: headers(token), payload: { amount: 20 },
    });
    expect(r.statusCode).toBe(403);
  });

  it('🔴 production pays no points and no window spend on an unpaid order — and still pays on a funded one', async () => {
    // EXPLOIT (before): POST /v1/checkout {paymentMethod:"cash", 60 coffees}
    // → 201, pointsEarned 200; POST /v1/loyalty/redeem {points:200} → a code
    // worth 2 JOD at the till. Repeatable with a fresh Idempotency-Key, and
    // the window spend bought the top rung permanently.
    const cashToken = await signIn(app, freshPhone());
    asProduction();
    const cash = await app.inject({
      method: 'POST', url: '/v1/checkout', headers: headers(cashToken),
      payload: { branchId: 'b1', orderType: 'pickup', paymentMethod: 'cash', lines: [line(60)] },
    });
    expect(cash.statusCode).toBe(201);                 // the order itself stands
    expect(cash.json().pointsEarned).toBe(0);
    const bal = (await app.inject({ method: 'GET', url: '/v1/me/balance', headers: { authorization: `Bearer ${cashToken}` } })).json();
    expect(bal.points).toBe(0);
    expect(bal.windowSpend).toBe(0);

    // The gate discriminates rather than switching earning off: a WALLET order
    // in the same production process still earns.
    restoreConfig();
    const walletToken = await signIn(app, freshPhone());
    await backend.creditWallet(subOf(walletToken), 100_000, 'topup');
    asProduction();
    const funded = await app.inject({
      method: 'POST', url: '/v1/checkout', headers: headers(walletToken),
      payload: { branchId: 'b1', orderType: 'pickup', paymentMethod: 'wallet', lines: [line(2)] },
    });
    expect(funded.statusCode).toBe(201);
    expect(funded.json().pointsEarned).toBeGreaterThan(0);
  });

  it('bounds the checkout body (lines, qty, branch id)', async () => {
    const token = await signIn(app, freshPhone());
    const post = (payload: Record<string, unknown>) => app.inject({ method: 'POST', url: '/v1/checkout', headers: headers(token), payload });
    const base = { branchId: 'b1', orderType: 'pickup', paymentMethod: 'cash' };
    expect((await post({ ...base, lines: [line(1001)] })).statusCode).toBe(400);
    expect((await post({ ...base, lines: Array.from({ length: 501 }, () => line(1)) })).statusCode).toBe(400);
    expect((await post({ ...base, branchId: 'b'.repeat(65), lines: [line(1)] })).statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// S14 — rate limits the per-phone caps could not provide.
// ---------------------------------------------------------------------------
describe('S14 rate limits', () => {
  let app: FastifyInstance;
  let backend: Backend;
  beforeAll(async () => { backend = createMemoryBackend(); app = await build(backend); });
  afterAll(async () => { await app.close(); });

  it('🔴 one source cannot spray guesses across many phones', async () => {
    // EXPLOIT (before): per-phone caps allow 5 guesses × 5 sends = 25/hour for
    // EACH phone, with nothing across phones — ~1.2M guesses/hour over 47,720
    // members, i.e. roughly one account taken per hour from one laptop.
    const attacker = '203.0.113.7';
    const max = config.RATE_LIMITS.otpFailedVerifyPerIp.max;
    for (let i = 0; i < max; i++) {
      const phone = freshPhone();
      const { code } = requestOtp(normalizePhone(phone));
      const wrong = code === '000000' ? '111111' : '000000';
      const r = await app.inject({
        method: 'POST', url: '/v1/auth/otp/verify', remoteAddress: attacker, payload: { phone, code: wrong },
      });
      expect(r.statusCode).toBe(401);
    }
    // Budget spent: even a RIGHT code is refused from this source...
    const victim = freshPhone();
    const { code } = requestOtp(normalizePhone(victim));
    const blocked = await app.inject({
      method: 'POST', url: '/v1/auth/otp/verify', remoteAddress: attacker, payload: { phone: victim, code },
    });
    expect(blocked.statusCode).toBe(429);
    // ...while an honest source is untouched, and the victim's code survived.
    const honest = await app.inject({
      method: 'POST', url: '/v1/auth/otp/verify', remoteAddress: '198.51.100.9', payload: { phone: victim, code },
    });
    expect(honest.statusCode).toBe(200);
  });

  it('successful sign-ins do not count against a shared (carrier-NAT) address', async () => {
    const nat = '100.64.0.1';
    for (let i = 0; i < config.RATE_LIMITS.otpFailedVerifyPerIp.max + 5; i++) {
      const phone = freshPhone();
      const { code } = requestOtp(normalizePhone(phone));
      const r = await app.inject({ method: 'POST', url: '/v1/auth/otp/verify', remoteAddress: nat, payload: { phone, code } });
      expect(r.statusCode).toBe(200);
    }
  });

  it('🔴 one source cannot have us text an unbounded number of phones', async () => {
    const src = '203.0.113.8';
    const max = config.RATE_LIMITS.otpRequestPerIp.max;
    for (let i = 0; i < max; i++) {
      const r = await app.inject({ method: 'POST', url: '/v1/auth/otp/request', remoteAddress: src, payload: { phone: freshPhone() } });
      expect(r.statusCode).toBe(200);
    }
    const over = await app.inject({ method: 'POST', url: '/v1/auth/otp/request', remoteAddress: src, payload: { phone: freshPhone() } });
    expect(over.statusCode).toBe(429);
    const other = await app.inject({ method: 'POST', url: '/v1/auth/otp/request', remoteAddress: '198.51.100.10', payload: { phone: freshPhone() } });
    expect(other.statusCode).toBe(200);
  });

  it('redemption minting is bounded per member', async () => {
    const token = await signIn(app, freshPhone());
    await backend.addPoints(subOf(token), 10_000, 'test', 'test');
    const max = config.RATE_LIMITS.redeemPerMember.max;
    for (let i = 0; i < max; i++) {
      const r = await app.inject({ method: 'POST', url: '/v1/loyalty/redeem', headers: headers(token), payload: { points: 1 } });
      expect(r.statusCode).toBe(201);
    }
    const over = await app.inject({ method: 'POST', url: '/v1/loyalty/redeem', headers: headers(token), payload: { points: 1 } });
    expect(over.statusCode).toBe(429);
    // Per MEMBER: somebody else is not affected.
    const other = await signIn(app, freshPhone());
    const r = await app.inject({ method: 'POST', url: '/v1/loyalty/redeem', headers: headers(other), payload: { points: 1 } });
    expect(r.statusCode).toBe(409); // insufficient_points — i.e. it got past the limiter
  });

  it('web settlement attempts are bounded per member', async () => {
    const token = await signIn(app, freshPhone());
    const max = config.RATE_LIMITS.settlePerMember.max;
    for (let i = 0; i < max; i++) {
      const r = await app.inject({ method: 'POST', url: '/v1/loyalty/redemption/settle', headers: headers(token), payload: { code: 'ABCD-EFGH' } });
      expect(r.statusCode).toBe(404);
    }
    const over = await app.inject({ method: 'POST', url: '/v1/loyalty/redemption/settle', headers: headers(token), payload: { code: 'ABCD-EFGH' } });
    expect(over.statusCode).toBe(429);
  });

  it('the corporate quote is bounded per member and refuses non-finite totals', async () => {
    const token = await signIn(app, freshPhone());
    const h = { authorization: `Bearer ${token}` };
    expect((await app.inject({ method: 'POST', url: '/v1/me/corporate/quote', headers: h, payload: { subtotal: -5 } })).statusCode).toBe(400);
    __resetRateLimits();
    const max = config.RATE_LIMITS.quotePerMember.max;
    for (let i = 0; i < max; i++) {
      expect((await app.inject({ method: 'POST', url: '/v1/me/corporate/quote', headers: h, payload: { subtotal: 10 } })).statusCode).toBe(200);
    }
    expect((await app.inject({ method: 'POST', url: '/v1/me/corporate/quote', headers: h, payload: { subtotal: 10 } })).statusCode).toBe(429);
  });

  it('stockout reports are bounded in size and rate', async () => {
    const token = await signIn(app, freshPhone());
    const h = { authorization: `Bearer ${token}` };
    const post = (payload: Record<string, unknown>) => app.inject({ method: 'POST', url: '/v1/analytics/stockout', headers: h, payload });
    expect((await post({ branchId: 'b1', itemId: 'x'.repeat(100_000) })).statusCode).toBe(400);
    __resetRateLimits();
    for (let i = 0; i < config.RATE_LIMITS.stockoutPerMember.max; i++) {
      expect((await post({ branchId: 'b1', itemId: 'x' })).statusCode).toBe(201);
    }
    expect((await post({ branchId: 'b1', itemId: 'x' })).statusCode).toBe(429);
  });
});

// ---------------------------------------------------------------------------
// S15 — production boot refuses a wildcard CORS and a guessable shared key.
// ---------------------------------------------------------------------------
describe('S15 production boot', () => {
  const strong = {
    NODE_ENV: 'production',
    JWT_SECRET: 'x'.repeat(48), POS_TOKEN_SECRET: 'y'.repeat(48),
    POS_SCAN_KEY: 'z'.repeat(32), ADMIN_KEY: 'w'.repeat(32),
  };

  it('🔴 refuses CORS_ORIGINS="*" in production (the config default)', () => {
    expect(insecureBootReasons({ ...strong, CORS_ORIGINS: '*' }).join(' | ')).toMatch(/CORS_ORIGINS/);
    expect(insecureBootReasons({ ...strong, CORS_ORIGINS: 'https://almond.jo, *' }).join(' | ')).toMatch(/CORS_ORIGINS/);
    expect(insecureBootReasons({ ...strong, CORS_ORIGINS: 'https://almond.jo,https://admin.almond.jo' })).toEqual([]);
    // Development stays runnable with the wildcard, as T29g requires.
    expect(insecureBootReasons({ ...strong, NODE_ENV: 'development', CORS_ORIGINS: '*' })).toEqual([]);
  });

  it('🔴 refuses a short POS or admin key (set is not the same as strong)', () => {
    const r = insecureBootReasons({ ...strong, POS_SCAN_KEY: 'till1', ADMIN_KEY: 'admin' }).join(' | ');
    expect(r).toMatch(/POS_SCAN_KEY is shorter/);
    expect(r).toMatch(/ADMIN_KEY is shorter/);
  });

  it('production refuses to boot on the memory store, or with TRUST_PROXY unstated', () => {
    const base = { ...strong, CORS_ORIGINS: 'https://almond.jo' };
    const mem = insecureBootReasons({ ...base, DATABASE_URL: '', TRUST_PROXY_SET: true }).join(' | ');
    expect(mem).toMatch(/DATABASE_URL is unset/);
    const proxy = insecureBootReasons({ ...base, DATABASE_URL: 'postgresql://x', TRUST_PROXY_SET: false }).join(' | ');
    expect(proxy).toMatch(/TRUST_PROXY is unset/);
    // Both stated → nothing to refuse. "false" is a decision, not an omission.
    expect(insecureBootReasons({ ...base, DATABASE_URL: 'postgresql://x', TRUST_PROXY_SET: true })).toEqual([]);
    // Development runs on memory by design.
    expect(insecureBootReasons({ ...base, NODE_ENV: 'development', DATABASE_URL: '', TRUST_PROXY_SET: false })).toEqual([]);
  });

  it('the default call — the one build() makes — reads CORS from the live config', () => {
    const prev = config.CORS_ORIGINS;
    try {
      cfg.NODE_ENV = 'production';
      cfg.CORS_ORIGINS = '*';
      expect(insecureBootReasons().join(' | ')).toMatch(/CORS_ORIGINS/);
      cfg.CORS_ORIGINS = 'https://almond.jo';
      expect(insecureBootReasons().join(' | ')).not.toMatch(/CORS_ORIGINS/);
    } finally {
      cfg.CORS_ORIGINS = prev;
    }
  });
});

// ---------------------------------------------------------------------------
// S16 — the idempotency store is bounded.
// ---------------------------------------------------------------------------
describe('S16 idempotency store', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await build(); });
  afterAll(async () => { await app.close(); vi.useRealTimers(); });

  it('🔴 refuses an oversized key (each was stored forever, up to the 16 KB header limit)', async () => {
    const token = await signIn(app, freshPhone());
    const r = await app.inject({
      method: 'POST', url: '/v1/loyalty/redeem',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'k'.repeat(4096) },
      payload: { points: 1 },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe('idempotency_key_required');
  });

  it('🔴 an entry expires after 24 hours instead of living forever', async () => {
    const token = await signIn(app, freshPhone());
    const key = randomUUID();
    const send = () => app.inject({
      method: 'POST', url: '/v1/me/redemption/cancel',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
      payload: { redemptionId: 'rdm_nope' },
    });
    const first = await send();
    expect(first.statusCode).toBe(404);
    expect((await send()).headers['idempotent-replay']).toBe('true');   // replayed while fresh
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
    const later = await send();
    vi.useRealTimers();
    expect(later.headers['idempotent-replay']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// S17 — the member JWT. EVIDENCE, not a fix: these pass on the code as found.
// ---------------------------------------------------------------------------
describe('S17 member JWT (@fastify/jwt) refuses forged, unsigned and expired tokens', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await build(); });
  afterAll(async () => { await app.close(); });

  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const hs256 = (payload: unknown, secret: string) => {
    const head = b64({ alg: 'HS256', typ: 'JWT' });
    const body = b64(payload);
    return `${head}.${body}.${createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')}`;
  };
  const get = (token: string) => app.inject({ method: 'GET', url: '/v1/me/balance', headers: { authorization: `Bearer ${token}` } });
  const now = () => Math.floor(Date.now() / 1000);

  it('control: a correctly signed token is accepted', async () => {
    const real = await signIn(app, freshPhone());
    expect((await get(real)).statusCode).toBe(200);
  });

  it('alg:none is refused', async () => {
    const t = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'demo', exp: now() + 3600 })}.`;
    expect((await get(t)).statusCode).toBe(401);
  });

  it('a token signed with another secret is refused', async () => {
    expect((await get(hs256({ sub: 'demo', exp: now() + 3600 }, 'not-the-secret'))).statusCode).toBe(401);
  });

  it('an expired token is refused', async () => {
    expect((await get(hs256({ sub: 'demo', exp: now() - 10 }, config.JWT_SECRET))).statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// S18 — every route is classified, and every non-public route refuses a caller
// without the credential its class requires. A NEW route that is not added to
// this table fails the first test, so an unguarded route cannot arrive quietly
// — the way /v1/analytics/order-lines arrived guarded as a member route.
// ---------------------------------------------------------------------------
/** `signed`: the credential is a payment gateway's signature over the raw
 *  body (routes/payments.ts) — no member, no shared key. */
type Guard = 'public' | 'member' | 'admin' | 'pos' | 'signed';
const ROUTES: Record<string, Guard> = {
  'GET /health': 'public',
  'POST /v1/auth/otp/request': 'public',
  'POST /v1/auth/otp/verify': 'public',
  'POST /v1/checkout': 'member',
  'GET /v1/admin/companies': 'admin',
  'PUT /v1/admin/companies': 'admin',
  'PUT /v1/admin/companies/:id/roster': 'admin',
  'GET /v1/admin/companies/:id/roster': 'admin',
  'GET /v1/admin/corporate/uses': 'admin',
  'GET /v1/me/corporate': 'member',
  'POST /v1/me/corporate/quote': 'member',
  'POST /v1/wallet/topup': 'member',
  'POST /v1/loyalty/redeem': 'member',
  'GET /v1/me/redemption': 'member',
  'POST /v1/me/redemption/qr': 'member',
  'POST /v1/me/redemption/cancel': 'member',
  'POST /v1/loyalty/redemption/settle': 'member',
  'GET /v1/me/voucher': 'member',
  'POST /v1/loyalty/voucher/redeem': 'member',
  'POST /v1/pos/token': 'member',
  'POST /v1/pos/scan': 'pos',
  'POST /v1/pos/redemption/settle': 'pos',
  'POST /v1/pos/earn': 'pos',
  'POST /v1/pos/earn/reverse': 'pos',
  'POST /v1/pos/points/spend': 'pos',
  'POST /v1/pos/identify': 'pos',
  'POST /v1/pos/points/spend/reverse': 'pos',
  'POST /v1/payments/intent': 'member',
  'POST /v1/payments/webhook/:provider': 'signed',
  'POST /v1/me/profile': 'member',
  'GET /v1/me/balance': 'member',
  'GET /v1/me/wallet': 'member',
  'GET /v1/me/history': 'member',
  'GET /v1/me/referral': 'member',
  'POST /v1/me/referral/attach': 'member',
  'POST /v1/me/transfers/preview': 'member',
  'POST /v1/me/transfers': 'member',
  'GET /v1/analytics/order-lines': 'admin',
  'POST /v1/analytics/stockout': 'member',
  'GET /v1/forecast/prep-sheet': 'admin',
};

describe('S18 the route guard matrix', () => {
  let app: FastifyInstance;
  const served: string[] = [];
  beforeAll(async () => {
    app = await build();
    // Read the routes off the running server, not off a copy of the list.
    for (const key of Object.keys(ROUTES)) {
      const [method, url] = key.split(' ');
      if (app.hasRoute({ method: method as 'GET', url })) served.push(key);
    }
  });
  afterAll(async () => { await app.close(); });

  it('every served route is classified, and every classified route is served', () => {
    // The printed tree nests a route under its prefix ("│   └── /quote (POST)"
    // under /v1/me/corporate), so rebuild the full path from the indentation.
    const seen = new Set<string>();
    const stack: string[] = [];
    for (const row of app.printRoutes({ commonPrefix: false }).split('\n')) {
      const m = /^(.*?)[├└]── (\/\S*) \(([A-Z, ]+)\)/.exec(row);
      if (!m) continue;
      const depth = m[1].length / 4;
      stack.length = depth;
      const path = (depth > 0 ? stack[depth - 1] : '') + m[2];
      stack.push(path);
      for (const verb of m[3].split(',').map((v) => v.trim())) {
        if (verb === 'HEAD' || verb === 'OPTIONS') continue;
        seen.add(`${verb} ${path}`);
      }
    }
    expect(seen.size, 'the route tree could not be read').toBeGreaterThan(20);
    expect([...seen].filter((k) => !(k in ROUTES)), 'unclassified route(s) — add them to ROUTES with their guard').toEqual([]);
    expect(served.sort()).toEqual(Object.keys(ROUTES).sort());
  });

  it('no credential ⇒ 401 on every non-public route', async () => {
    // A gateway must be configured for its webhook to be reachable at all
    // (unconfigured, it is a 503 — covered in payments.test.ts); with the
    // mock, an unsigned body must be a 401 like every other missing credential.
    const prevProvider = config.PAYMENT_PROVIDER;
    cfg.PAYMENT_PROVIDER = 'mock';
    const open: string[] = [];
    try {
      for (const [key, guard] of Object.entries(ROUTES)) {
        if (guard === 'public') continue;
        const [method, url] = key.split(' ');
        const r = await app.inject({
          method: method as 'GET', url: url.replace(':id', 'x').replace(':provider', 'mock'),
          headers: { 'idempotency-key': randomUUID() }, payload: method === 'GET' ? undefined : {},
        });
        if (r.statusCode !== 401) open.push(`${key} → ${r.statusCode}`);
      }
    } finally {
      cfg.PAYMENT_PROVIDER = prevProvider;
    }
    expect(open).toEqual([]);
  });

  it('a member JWT opens no admin or POS route', async () => {
    const token = await signIn(app, freshPhone());
    const open: string[] = [];
    for (const [key, guard] of Object.entries(ROUTES)) {
      if (guard !== 'admin' && guard !== 'pos') continue;
      const [method, url] = key.split(' ');
      const r = await app.inject({
        method: method as 'GET', url: url.replace(':id', 'x').replace(':provider', 'mock'),
        headers: headers(token), payload: method === 'GET' ? undefined : {},
      });
      if (r.statusCode !== 401) open.push(`${key} → ${r.statusCode}`);
    }
    expect(open).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// S19 — a pay/earn QR is not consent to spend a saved redemption.
// ---------------------------------------------------------------------------
describe('S19 the till settles a redemption only from a redeem-mode QR', () => {
  let app: FastifyInstance;
  let backend: Backend;
  const KEY = 'security-review-pos-key-'.padEnd(32, 'x');
  const prevKey = config.POS_SCAN_KEY;
  beforeAll(async () => { backend = createMemoryBackend(); app = await build(backend); cfg.POS_SCAN_KEY = KEY; });
  afterAll(async () => { cfg.POS_SCAN_KEY = prevKey; await app.close(); });

  it('🔴 a pay-mode QR cannot consume the member\'s live redemption (was: settled)', async () => {
    const token = await signIn(app, freshPhone());
    const id = subOf(token);
    await backend.addPoints(id, 500, 'test', 'test');
    await backend.createRedemption(id, 300);
    const payQr = await app.inject({ method: 'POST', url: '/v1/pos/token', headers: { authorization: `Bearer ${token}` }, payload: { mode: 'pay' } });
    const r = await app.inject({
      method: 'POST', url: '/v1/pos/redemption/settle', headers: { 'x-pos-key': KEY }, payload: { token: payQr.json().token },
    });
    expect(r.statusCode).toBe(400);
    expect((await backend.activeRedemption(id))?.settledAt ?? null).toBeNull();

    // The member's own redemption QR still works.
    const redeemQr = await app.inject({ method: 'POST', url: '/v1/me/redemption/qr', headers: { authorization: `Bearer ${token}` } });
    const ok = await app.inject({
      method: 'POST', url: '/v1/pos/redemption/settle', headers: { 'x-pos-key': KEY }, payload: { token: redeemQr.json().token },
    });
    expect(ok.statusCode).toBe(201);
  });
});
