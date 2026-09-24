import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createHmac, randomUUID } from 'node:crypto';
import { liveBalance } from '@almond/shared/loyalty/lots';
import { computeEarn } from '@almond/shared/loyalty/earn';
import { config } from '../src/config';
import { build } from '../src/server';
import { createMemoryBackend } from '../src/backend/memory';
import { createPostgresBackend } from '../src/backend/postgres';
import type { Backend } from '../src/backend';
import { issueEarnTicket, issuePosToken, issueSpendTicket, readEarnTicket, readSpendTicket } from '../src/pos/token';
import { __resetRateLimits } from '../src/plugins/rateLimit';
import { __resetOtpState } from '../src/auth/otp';
import { pgTestDb } from './lib/pgTestDb';
import { signIn } from './lib/signIn';

/**
 * P2 — ONE BARCODE FOR EARNING AND SPENDING IN STORE.
 *
 * Owner, 2026-09-24: «كسب وصرف النقاط بدي يكون باركود مباشر نفسه … اذا دفعت
 * بتقدر تدفع بالمحل من نقاطك بالباركود … لازم ما يصير خلط بين النقاط المكتسبة
 * وطريقة الدفع وبنفس الوقت سهله وعمليه».
 *
 * One member code, scanned ONCE per visit. The scan hands the till an earn
 * ticket and a 15-minute spend ticket; the member says whether to use points;
 * POST /v1/pos/points/spend takes them off the bill as a TENDER; the money part
 * earns through /v1/pos/earn under the same posOrderRef.
 */

type Mutable = Record<string, unknown>;
const cfg = config as unknown as Mutable;
const KEY = 'pos-spend-test-key-'.padEnd(40, 's');
const saved = {
  POS_SCAN_KEY: config.POS_SCAN_KEY, RATE_LIMITS: config.RATE_LIMITS,
  POS_SPEND_MAX_POINTS_PER_SALE: config.POS_SPEND_MAX_POINTS_PER_SALE,
};

let phoneSeq = 0;
const freshPhone = () => `079${String(5_000_000 + phoneSeq++).padStart(7, '0')}`;
const subOf = (token: string) =>
  (JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as { sub: string }).sub;

beforeEach(() => { __resetRateLimits(); __resetOtpState(); });
afterEach(() => {
  cfg.RATE_LIMITS = saved.RATE_LIMITS;
  cfg.POS_SPEND_MAX_POINTS_PER_SALE = saved.POS_SPEND_MAX_POINTS_PER_SALE;
  vi.useRealTimers();
});

describe.each([
  ['memory', async () => createMemoryBackend()],
  ['postgres (pglite)', async () => createPostgresBackend(await pgTestDb())],
] as [string, () => Promise<Backend>][])('P2 one code: scan once, spend points as a tender, earn on the money — %s', (_name, make) => {
  let app: FastifyInstance;
  let backend: Backend;
  beforeAll(async () => { backend = await make(); app = await build(backend); cfg.POS_SCAN_KEY = KEY; }, 60_000);
  afterAll(async () => { cfg.POS_SCAN_KEY = saved.POS_SCAN_KEY; await app.close(); });

  const pos = (url: string, payload: unknown, key: string | null = KEY) => app.inject({
    method: 'POST', url, payload: payload as Record<string, unknown>, headers: key === null ? {} : { 'x-pos-key': key },
  });
  /** The ONE member code — no mode, exactly what the app should mint now. */
  const code = async (member: string, payload: Record<string, unknown> = {}) =>
    (await app.inject({ method: 'POST', url: '/v1/pos/token', headers: { authorization: `Bearer ${member}` }, payload })).json().token as string;
  const points = async (id: string) => liveBalance((await backend.getMember(id)).lots);
  const spend = (body: Record<string, unknown>, key?: string | null) => pos('/v1/pos/points/spend', body, key);
  const unspend = (body: Record<string, unknown>, key?: string | null) => pos('/v1/pos/points/spend/reverse', body, key);

  /** A member holding `balance` points, standing at the till with a fresh scan. */
  const atTill = async (balance = 120) => {
    const token = await signIn(app, freshPhone());
    const id = subOf(token);
    if (balance > 0) await backend.addPoints(id, balance, 'منحة', 'Grant');
    const scan = await pos('/v1/pos/scan', { token: await code(token) });
    expect(scan.statusCode).toBe(200);
    return { token, id, scan: scan.json() };
  };

  it('P2.1 🔴 ONE scan hands the till the balance, what it can take off the bill, an earn ticket AND a spend ticket', async () => {
    const { id, scan } = await atTill(1_234);
    expect(scan).toMatchObject({
      memberId: id, mode: 'pay', earnsPoints: true, pointsBalance: 1_234, spendableJod: 12.34,
      spendTicketExpiresIn: config.POS_SPEND_TICKET_TTL_SECONDS,
      earnTicketExpiresIn: config.POS_EARN_TICKET_TTL_SECONDS,
    });
    expect(config.POS_SPEND_TICKET_TTL_SECONDS).toBe(15 * 60);
    expect(readEarnTicket(scan.earnTicket).memberId).toBe(id);
    expect(readSpendTicket(scan.spendTicket).memberId).toBe(id);
    // The old mode-bearing codes still work, and all three are now the member
    // code: the member no longer picks a mode, the till asks at the counter.
    const token = await signIn(app, freshPhone());
    for (const mode of ['pay', 'earn', 'corporate'] as const) {
      const s = (await pos('/v1/pos/scan', { token: await code(token, { mode }) })).json();
      expect(typeof s.earnTicket, mode).toBe('string');
      expect(typeof s.spendTicket, mode).toBe('string');
      expect(s.pointsBalance, mode).toBe(0);
      expect(s.spendableJod, mode).toBe(0);
    }
  });

  it('P2.2 a legacy redeem QR is a READ of a code already paid for — no tickets of either kind', async () => {
    const token = await signIn(app, freshPhone());
    const s = (await pos('/v1/pos/scan', { token: await code(token, { mode: 'redeem' }) })).json();
    expect(s.earnTicket).toBeNull();
    expect(s.spendTicket).toBeNull();
    expect(s.spendTicketExpiresIn).toBeNull();
  });

  it('P2.3 🔴 spend exactly the points asked, as a tender: stored answer on retry, 409 on a changed amount', async () => {
    const { id, scan } = await atTill(120);
    const ref = `Shop/${randomUUID()}`;
    const r = await spend({ spendTicket: scan.spendTicket, posOrderRef: ref, points: 50 });
    expect(r.statusCode).toBe(201);
    expect(r.json()).toEqual({ posOrderRef: ref, pointsSpent: 50, valueJod: 0.5, pointsBalance: 70, replay: false });
    expect(await points(id)).toBe(70);
    for (let i = 0; i < 2; i += 1) {
      const again = await spend({ spendTicket: scan.spendTicket, posOrderRef: ref, points: 50 });
      expect(again.statusCode).toBe(200);
      expect(again.json()).toEqual({ ...r.json(), replay: true });
    }
    const changed = await spend({ spendTicket: scan.spendTicket, posOrderRef: ref, points: 51 });
    expect([changed.statusCode, changed.json().error]).toEqual([409, 'pos_order_conflict']);
    expect(await points(id)).toBe(70);
    // One ticket, one sale: the same ticket on ANOTHER order is refused.
    const second = await spend({ spendTicket: scan.spendTicket, posOrderRef: `Shop/${randomUUID()}`, points: 10 });
    expect([second.statusCode, second.json().error]).toEqual([409, 'ticket_used']);
    expect(await points(id)).toBe(70);
  });

  it('P2.4 🔴 the money part earns; the points tender does not — the till reports paidTotal WITHOUT the points', async () => {
    // A 5.000 JOD bill; the member uses 50 points (0.500 JOD). The till takes
    // the tender, collects 4.500 in money, and reports 4.500 to /earn under the
    // SAME posOrderRef.
    const { id, scan } = await atTill(50);
    const ref = `Shop/${randomUUID()}`;
    const tender = (await spend({ spendTicket: scan.spendTicket, posOrderRef: ref, points: 50 })).json();
    expect(tender.valueJod).toBe(0.5);
    const paidTotal = 5 - tender.valueJod;
    const standing = await backend.getStanding(id);
    const paidAt = new Date();
    const expected = computeEarn({
      total: paidTotal, corporate: false, pointsRedeemed: 0, windowSpend: standing.windowSpend,
      heldRungId: standing.held.id, paidFromBalance: false, bonusDayActivated: false, at: paidAt,
    }).points;
    const earned = await pos('/v1/pos/earn', { earnTicket: scan.earnTicket, posOrderRef: ref, branchId: 'b1', paidTotal, paidAt: paidAt.toISOString() });
    expect(earned.statusCode).toBe(201);
    expect(earned.json().pointsEarned).toBe(expected);
    expect(await points(id)).toBe(expected);
    expect((await backend.getStanding(id)).windowSpend).toBe(4.5);
    // 🔴 DOCUMENTED, NOT ENFORCED: the server has the spend row but not the
    // bill, so it cannot tell "the bill" from "the bill minus the points".
    // What it pays is a function of the paidTotal it is SENT — a till that
    // reported the whole 5.000 would earn on 5.000. docs/INTEGRATIONS.md §2
    // tells the till to subtract the tender; this pins that nothing else does.
    const other = await atTill(50);
    const ref2 = `Shop/${randomUUID()}`;
    await spend({ spendTicket: other.scan.spendTicket, posOrderRef: ref2, points: 50 });
    const wrong = (await pos('/v1/pos/earn', { earnTicket: other.scan.earnTicket, posOrderRef: ref2, branchId: 'b1', paidTotal: 5 })).json();
    const onWhole = computeEarn({ total: 5, windowSpend: 0, at: new Date() }).points;
    expect(wrong.pointsEarned).toBe(onWhole);
    expect(onWhole).toBeGreaterThan(expected);
  });

  it('P2.5 🔴 more than the balance is 409, more than the per-sale cap is 400, a bad amount is 400 — nothing moves', async () => {
    const { id, scan } = await atTill(100);
    const short = await spend({ spendTicket: scan.spendTicket, posOrderRef: `Shop/${randomUUID()}`, points: 101 });
    expect([short.statusCode, short.json().error]).toEqual([409, 'insufficient_points']);
    cfg.POS_SPEND_MAX_POINTS_PER_SALE = 60;
    const over = await spend({ spendTicket: scan.spendTicket, posOrderRef: `Shop/${randomUUID()}`, points: 61 });
    expect([over.statusCode, over.json().error]).toEqual([400, 'points_over_sale_cap']);
    for (const bad of [0, -5, 1.5, '50', null]) {
      const r = await spend({ spendTicket: scan.spendTicket, posOrderRef: `Shop/${randomUUID()}`, points: bad });
      expect(r.statusCode, String(bad)).toBe(400);
    }
    expect((await spend({ spendTicket: scan.spendTicket, posOrderRef: '', points: 5 })).statusCode).toBe(400);
    expect(await points(id)).toBe(100);
    expect(await backend.getHistory(id)).toHaveLength(1);           // the grant only
    // The refusals did not burn the ticket: the same one still pays, at the cap.
    expect((await spend({ spendTicket: scan.spendTicket, posOrderRef: `Shop/${randomUUID()}`, points: 60 })).statusCode).toBe(201);
    expect(config.POS_SPEND_MAX_POINTS_PER_SALE).toBe(60);
    expect(saved.POS_SPEND_MAX_POINTS_PER_SALE).toBe(10_000);        // the shipped cap: 100.00 JOD
  });

  it('P2.6 🔴 only a SPEND ticket spends: an earn ticket, a QR or a forged ticket is 401 ticket_invalid', async () => {
    const { id, scan } = await atTill(200);
    const [body, sig] = (scan.spendTicket as string).split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), sub: 'demo' })).toString('base64url');
    for (const bad of [scan.earnTicket, issueEarnTicket(id).ticket, issuePosToken(id).token, `${forged}.${sig}`, 'garbage']) {
      const r = await spend({ spendTicket: bad, posOrderRef: `Shop/${randomUUID()}`, points: 10 });
      expect([r.statusCode, r.json().error], String(bad).slice(0, 16)).toEqual([401, 'ticket_invalid']);
    }
    // BOTH LAYERS, each on its own: a payload that SAYS `spend` but is signed
    // in the EARN domain is refused (domain separation), and a payload signed
    // in the SPEND domain that says `earn` is refused (the typ claim).
    const craft = (typ: string, domain: string) => {
      const b = Buffer.from(JSON.stringify({ typ, sub: id, jti: randomUUID(), iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url');
      return `${b}.${createHmac('sha256', config.POS_TOKEN_SECRET).update(`${domain}${b}`).digest('base64url')}`;
    };
    expect(() => readSpendTicket(craft('spend', 'almond.pos.earn-ticket.v1\n'))).toThrow(/not issued by this server/);
    expect(() => readSpendTicket(craft('earn', 'almond.pos.spend-ticket.v1\n'))).toThrow(/not issued by this server/);
    expect(readSpendTicket(craft('spend', 'almond.pos.spend-ticket.v1\n')).memberId).toBe(id);   // CONTROL
    // …and the other direction: a spend ticket does not earn.
    const earn = await pos('/v1/pos/earn', { earnTicket: scan.spendTicket, posOrderRef: `Shop/${randomUUID()}`, branchId: 'b1', paidTotal: 5 });
    expect([earn.statusCode, earn.json().error]).toEqual([401, 'ticket_invalid']);
    expect(await points(id)).toBe(200);
  });

  it('P2.7 🔴 spending must follow a FRESH scan: past 15 minutes a new spend is refused — a retry still answers', async () => {
    const { id, scan } = await atTill(90);
    const scannedAt = Date.now();
    const ref = `Shop/${randomUUID()}`;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(scannedAt + 14 * 60_000);
    expect((await spend({ spendTicket: scan.spendTicket, posOrderRef: ref, points: 30 })).statusCode).toBe(201);
    vi.setSystemTime(scannedAt + (config.POS_SPEND_TICKET_TTL_SECONDS + 5) * 1000);
    const late = await spend({ spendTicket: issueSpendTicketAt(id, scannedAt), posOrderRef: `Shop/${randomUUID()}`, points: 10 });
    expect([late.statusCode, late.json().error]).toEqual([401, 'ticket_expired']);
    const retry = await spend({ spendTicket: scan.spendTicket, posOrderRef: ref, points: 30 });
    vi.useRealTimers();
    expect([retry.statusCode, retry.json().replay]).toEqual([200, true]);
    expect(await points(id)).toBe(60);
  });

  it('P2.8 a corporate member earns 0 (no earn ticket) but MAY spend the points they hold', async () => {
    const phone = freshPhone();
    await backend.saveCompany({ id: `co${phone}`, nameAr: 'شركة', nameEn: 'Co', percentOff: 50, active: true });
    await backend.replaceRoster(`co${phone}`, [{ phone, companyId: `co${phone}` }]);
    const token = await signIn(app, phone);
    await backend.addPoints(subOf(token), 80, 'منحة', 'Grant');
    const scan = (await pos('/v1/pos/scan', { token: await code(token) })).json();
    expect(scan).toMatchObject({ earnsPoints: false, earnTicket: null, pointsBalance: 80, spendableJod: 0.8 });
    expect(scan.corporate.percentOff).toBe(50);
    const r = await spend({ spendTicket: scan.spendTicket, posOrderRef: `Shop/${randomUUID()}`, points: 80 });
    expect(r.json()).toMatchObject({ pointsSpent: 80, valueJod: 0.8, pointsBalance: 0 });
  });

  it('P2.9 🔴 the till voids the sale: the points come back ONCE, on their original clock', async () => {
    const { id, scan } = await atTill(75);
    const expiry = (await backend.getMember(id)).lots[0].expiresOn;
    const ref = `Shop/${randomUUID()}`;
    await spend({ spendTicket: scan.spendTicket, posOrderRef: ref, points: 75 });
    expect((await unspend({ posOrderRef: ref })).statusCode).toBe(400);            // reason required
    expect((await unspend({ posOrderRef: ref, reason: 'void' }, null)).statusCode).toBe(401);
    const r = await unspend({ posOrderRef: ref, reason: 'void' });
    expect(r.statusCode).toBe(201);
    expect(r.json()).toEqual({ posOrderRef: ref, pointsReturned: 75, pointsExpired: 0, pointsBalance: 75, replay: false });
    const again = await unspend({ posOrderRef: ref, reason: 'void' });
    expect([again.statusCode, again.json()]).toEqual([200, { ...r.json(), replay: true }]);
    expect(await points(id)).toBe(75);
    expect((await backend.getMember(id)).lots.filter((l) => l.remaining > 0).map((l) => l.expiresOn)).toEqual([expiry]);
    expect((await unspend({ posOrderRef: 'Shop/none', reason: 'void' })).statusCode).toBe(404);
    // A spend retried after its void replays the SPEND answer and takes nothing.
    const replay = await spend({ spendTicket: scan.spendTicket, posOrderRef: ref, points: 75 });
    expect([replay.statusCode, replay.json().replay]).toEqual([200, true]);
    expect(await points(id)).toBe(75);
  });

  it('P2.10 🔴 fails closed and is rate-limited per till AND per key, apart from earning', async () => {
    const { scan } = await atTill(10);
    for (const key of [null, 'x'.repeat(40)]) {
      expect((await spend({ spendTicket: scan.spendTicket, posOrderRef: 'Shop/k', points: 1 }, key)).json().error).toBe('pos_key_invalid');
      expect((await unspend({ posOrderRef: 'Shop/k', reason: 'x' }, key)).json().error).toBe('pos_key_invalid');
    }
    const run = async (n: number, f: (i: number) => Promise<{ statusCode: number }>) => {
      const out: number[] = [];
      for (let i = 0; i < n; i += 1) out.push((await f(i)).statusCode);
      return out;
    };
    const probe = (i: number) => unspend({ posOrderRef: `Shop/none-${i}`, reason: 'x' });
    cfg.RATE_LIMITS = { ...saved.RATE_LIMITS, posSpendPerTill: { max: 3, windowSeconds: 60 } };
    expect(await run(5, probe)).toEqual([404, 404, 404, 429, 429]);
    // Spending has its own budget: the chain still earns.
    expect((await pos('/v1/pos/earn/reverse', { posOrderRef: 'Shop/none', reason: 'x' })).statusCode).toBe(404);
    __resetRateLimits();
    cfg.RATE_LIMITS = { ...saved.RATE_LIMITS, posSpendPerKey: { max: 2, windowSeconds: 60 } };
    expect(await run(3, probe)).toEqual([404, 404, 429]);
  });
});

/** A spend ticket minted as if at `ms` — for the expiry test, which has moved
 *  the clock past the ticket the scan handed out. */
function issueSpendTicketAt(memberId: string, ms: number): string {
  const real = Date.now;
  Date.now = () => ms;
  try { return issueSpendTicket(memberId).ticket; } finally { Date.now = real; }
}
