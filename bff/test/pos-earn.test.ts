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
import { issueEarnTicket, issuePosToken, readEarnTicket, verifyPosToken } from '../src/pos/token';
import { __resetRateLimits } from '../src/plugins/rateLimit';
import { __resetOtpState } from '../src/auth/otp';
import { pgTestDb } from './lib/pgTestDb';
import { signIn } from './lib/signIn';

/**
 * P1 — THE TILL EARN. Owner, 2026-09-23: «اوافق النقاط بعد تاكيد الدفع» —
 * points only once the payment is confirmed. For an in-store sale the till is
 * the confirmation: /v1/pos/scan hands it an earn ticket for the member whose
 * QR it read, and /v1/pos/earn spends that ticket on ONE paid POS order.
 */

type Mutable = Record<string, unknown>;
const cfg = config as unknown as Mutable;
const KEY = 'pos-earn-test-key-'.padEnd(40, 'k');
const saved = {
  POS_SCAN_KEY: config.POS_SCAN_KEY, NODE_ENV: config.NODE_ENV, DATABASE_URL: config.DATABASE_URL,
  RATE_LIMITS: config.RATE_LIMITS,
};

let phoneSeq = 0;
const freshPhone = () => `079${String(6_000_000 + phoneSeq++).padStart(7, '0')}`;
const subOf = (token: string) =>
  (JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as { sub: string }).sub;

beforeEach(() => { __resetRateLimits(); __resetOtpState(); });
afterEach(() => {
  cfg.NODE_ENV = saved.NODE_ENV; cfg.DATABASE_URL = saved.DATABASE_URL; cfg.RATE_LIMITS = saved.RATE_LIMITS;
  vi.useRealTimers();
});

function tillOf(app: FastifyInstance) {
  const pos = (url: string, payload: unknown, key: string | null = KEY) => app.inject({
    method: 'POST', url, payload: payload as Record<string, unknown>, headers: key === null ? {} : { 'x-pos-key': key },
  });
  return {
    qr: async (member: string, mode: 'pay' | 'earn' | 'redeem' | 'corporate' = 'earn') =>
      (await app.inject({ method: 'POST', url: '/v1/pos/token', headers: { authorization: `Bearer ${member}` }, payload: { mode } })).json().token as string,
    scan: (token: string) => pos('/v1/pos/scan', { token }),
    earn: (body: Record<string, unknown>, key?: string | null) => pos('/v1/pos/earn', body, key),
    reverse: (body: Record<string, unknown>, key?: string | null) => pos('/v1/pos/earn/reverse', body, key),
  };
}

describe.each([
  ['memory', async () => createMemoryBackend()],
  ['postgres (pglite)', async () => createPostgresBackend(await pgTestDb())],
] as [string, () => Promise<Backend>][])('P1 /v1/pos/earn — %s', (_name, make) => {
  let app: FastifyInstance;
  let backend: Backend;
  let till: ReturnType<typeof tillOf>;
  beforeAll(async () => { backend = await make(); app = await build(backend); cfg.POS_SCAN_KEY = KEY; till = tillOf(app); }, 60_000);
  afterAll(async () => { cfg.POS_SCAN_KEY = saved.POS_SCAN_KEY; await app.close(); });

  const points = async (id: string) => liveBalance((await backend.getMember(id)).lots);
  /** A signed-in member and the earn ticket their QR produced at the till. */
  const memberAtTill = async (mode: 'pay' | 'earn' = 'earn') => {
    const token = await signIn(app, freshPhone());
    const scan = await till.scan(await till.qr(token, mode));
    expect(scan.statusCode).toBe(200);
    return { token, id: subOf(token), scan: scan.json(), ticket: scan.json().earnTicket as string };
  };

  it('P1.1 an earning scan (pay or earn QR) carries a single-use earn ticket naming the member', async () => {
    for (const mode of ['pay', 'earn'] as const) {
      const { id, scan, ticket } = await memberAtTill(mode);
      expect(scan.earnsPoints).toBe(true);
      expect(typeof ticket).toBe('string');
      expect(scan.earnTicketExpiresIn).toBe(config.POS_EARN_TICKET_TTL_SECONDS);
      expect(readEarnTicket(ticket).memberId).toBe(id);
    }
  });

  it('P1.2 no ticket on a redeem-mode QR, nor for a member on a corporate roster', async () => {
    // Since the one-code change (2026-09-24) a 'corporate'-mode QR is just the
    // member code: the ROSTER decides who earns, not a mode the phone chose. A
    // member who is on no roster earns whatever their app minted.
    const token = await signIn(app, freshPhone());
    const redeem = (await till.scan(await till.qr(token, 'redeem'))).json();
    expect(redeem.earnTicket).toBeNull();
    expect(redeem.earnTicketExpiresIn).toBeNull();
    const notOnARoster = (await till.scan(await till.qr(token, 'corporate'))).json();
    expect(notOnARoster.earnsPoints).toBe(true);
    expect(typeof notOnARoster.earnTicket).toBe('string');
    const phone = freshPhone();
    await backend.saveCompany({ id: `co${phone}`, nameAr: 'شركة', nameEn: 'Co', percentOff: 50, active: true });
    await backend.replaceRoster(`co${phone}`, [{ phone, companyId: `co${phone}` }]);
    const staff = await signIn(app, phone);
    const scan = (await till.scan(await till.qr(staff, 'pay'))).json();
    expect(scan.earnsPoints).toBe(false);
    expect(scan.earnTicket).toBeNull();
  });

  it('P1.3 🔴 fails closed: no key, a wrong key, or no key configured at all ⇒ 401 and nothing granted', async () => {
    const { id, ticket } = await memberAtTill();
    const body = { earnTicket: ticket, posOrderRef: `Shop/${randomUUID()}`, branchId: 'b1', paidTotal: 10 };
    const refused = async (p: Promise<{ statusCode: number; json(): { error: string } }>) => {
      const r = await p;
      expect(r.statusCode).toBe(401);
      // A wrong KEY is a misconfigured till, told apart from a member problem.
      expect(r.json().error).toBe('pos_key_invalid');
    };
    await refused(till.earn(body, null));
    await refused(till.earn(body, 'x'.repeat(40)));
    await refused(app.inject({ method: 'POST', url: '/v1/pos/scan', payload: { token: 'anything' }, headers: { 'x-pos-key': 'nope' } }));
    await refused(app.inject({ method: 'POST', url: '/v1/pos/redemption/settle', payload: { code: 'ABCD2345' } }));
    cfg.POS_SCAN_KEY = '';
    try {
      await refused(till.earn(body, ''));
      await refused(till.reverse({ posOrderRef: body.posOrderRef, reason: 'x' }, ''));
    } finally { cfg.POS_SCAN_KEY = KEY; }
    expect(await points(id)).toBe(0);
  });

  it('P1.4 🔴 grants exactly what the shared earn function pays on the money collected, and counts the window', async () => {
    const { id, ticket } = await memberAtTill();
    const standing = await backend.getStanding(id);
    const paidAt = new Date();
    const expected = computeEarn({
      total: 12.75, corporate: false, pointsRedeemed: 0, windowSpend: standing.windowSpend,
      heldRungId: standing.held.id, paidFromBalance: false, bonusDayActivated: false, at: paidAt,
    }).points;
    expect(expected).toBeGreaterThan(0);                     // otherwise "exactly" proves nothing
    const ref = `Shop/${randomUUID()}`;
    const r = await till.earn({ earnTicket: ticket, posOrderRef: ref, branchId: 'b1', paidTotal: 12.75, paidAt: paidAt.toISOString() });
    expect(r.statusCode).toBe(201);
    expect(r.json()).toEqual({ posOrderRef: ref, pointsEarned: expected, pointsBalance: expected, replay: false });
    expect(await points(id)).toBe(expected);
    expect((await backend.getStanding(id)).windowSpend).toBe(12.75);
    expect((await backend.getTillSale(ref))?.earn?.points).toBe(expected);
  });

  it('P1.5 🔴 a retrying till gets the stored answer (replay) — and a different amount or branch is a 409', async () => {
    const { id, ticket } = await memberAtTill();
    const body = { earnTicket: ticket, posOrderRef: `Shop/${randomUUID()}`, branchId: 'b1', paidTotal: 20 };
    const first = await till.earn(body);
    expect(first.statusCode).toBe(201);
    for (let i = 0; i < 3; i += 1) {
      const again = await till.earn(body);
      expect(again.statusCode).toBe(200);
      expect(again.json()).toEqual({ ...first.json(), replay: true });
    }
    expect(await points(id)).toBe(first.json().pointsEarned);
    for (const change of [{ paidTotal: 20.001 }, { branchId: 'b2' }]) {
      const r = await till.earn({ ...body, ...change });
      expect(r.statusCode, JSON.stringify(change)).toBe(409);
      expect(r.json().error).toBe('pos_order_conflict');
    }
    expect(await points(id)).toBe(first.json().pointsEarned);
  });

  it('P1.6 🔴 one ticket pays for ONE sale: the same ticket on another POS order is refused', async () => {
    const { id, ticket } = await memberAtTill();
    expect((await till.earn({ earnTicket: ticket, posOrderRef: `Shop/${randomUUID()}`, branchId: 'b1', paidTotal: 10 })).statusCode).toBe(201);
    const second = await till.earn({ earnTicket: ticket, posOrderRef: `Shop/${randomUUID()}`, branchId: 'b1', paidTotal: 10 });
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe('ticket_used');
    expect(await points(id)).toBe((await backend.getHistory(id))[0].deltaPoints);
  });

  it('P1.7 🔴 only a ticket THIS server signed: forged, a QR in its place, or a ticket in a QR\'s place ⇒ refused', async () => {
    const { id, ticket } = await memberAtTill();
    const [body, sig] = ticket.split('.');
    const forgedBody = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), sub: 'demo' })).toString('base64url');
    const post = (earnTicket: string) => till.earn({ earnTicket, posOrderRef: `Shop/${randomUUID()}`, branchId: 'b1', paidTotal: 50 });
    for (const bad of [`${forgedBody}.${sig}`, `${body}.${sig.slice(0, -1)}${sig.endsWith('A') ? 'B' : 'A'}`, 'garbage', issuePosToken(id, 'earn').token]) {
      const r = await post(bad);
      expect(r.statusCode, bad.slice(0, 20)).toBe(401);
      expect(r.json().error).toBe('ticket_invalid');
    }
    // Signed correctly (with the ticket's own domain) but not an EARN payload:
    // the `typ` claim is checked too, not just the signature.
    const noTyp = Buffer.from(JSON.stringify({ sub: id, jti: randomUUID(), iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url');
    const noTypSig = createHmac('sha256', config.POS_TOKEN_SECRET).update(`almond.pos.earn-ticket.v1\n${noTyp}`).digest('base64url');
    expect(() => readEarnTicket(`${noTyp}.${noTypSig}`)).toThrow(/not issued by this server/);
    // …and the other direction: a ticket is not a QR.
    expect(() => verifyPosToken(issueEarnTicket(id).ticket)).toThrow(/bad pos signature/);
    expect((await till.scan(issueEarnTicket(id).ticket)).statusCode).toBe(401);
    expect(await points(id)).toBe(0);
  });

  it('P1.8 🔴 a ticket outlives a till outage: delivered days later it still pays — but not after its lifetime', async () => {
    // The Odoo addon queues /v1/pos/earn and retries for as long as the API is
    // down. The sale was PAID minutes after the scan; it is DELIVERED late.
    const { id, ticket } = await memberAtTill();
    const scannedAt = Date.now();
    const paidAt = new Date(scannedAt + 4 * 60_000).toISOString();
    const { ticket: second } = await memberAtTill();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(scannedAt + 2 * 24 * 3600_000);              // two days of outage
    const late = await till.earn({ earnTicket: ticket, posOrderRef: `Shop/${randomUUID()}`, branchId: 'b1', paidTotal: 15, paidAt });
    expect(late.statusCode).toBe(201);
    expect(late.json().pointsEarned).toBeGreaterThan(0);
    // Past the ticket's lifetime a NEW sale is refused, with its own code…
    vi.setSystemTime(scannedAt + (config.POS_EARN_TICKET_TTL_SECONDS + 60) * 1000);
    const dead = await till.earn({ earnTicket: second, posOrderRef: `Shop/${randomUUID()}`, branchId: 'b1', paidTotal: 15, paidAt });
    expect(dead.statusCode).toBe(401);
    expect(dead.json().error).toBe('ticket_expired');
    // …while the till's retry of the sale it already delivered still answers.
    const retry = await till.earn({ earnTicket: ticket, posOrderRef: late.json().posOrderRef, branchId: 'b1', paidTotal: 15, paidAt });
    vi.useRealTimers();
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toEqual({ ...late.json(), replay: true });
    expect(await points(id)).toBe(late.json().pointsEarned);
  });

  it('P1.8b 🔴 the sale must be PAID close to the scan: a held ticket cannot be attached to a later purchase', async () => {
    const { id, ticket } = await memberAtTill();
    const scannedAt = Date.now();
    const post = (offsetMs: number) => till.earn({
      earnTicket: ticket, posOrderRef: `Shop/${randomUUID()}`, branchId: 'b1', paidTotal: 90,
      paidAt: new Date(scannedAt + offsetMs).toISOString(),
    });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(scannedAt + 3 * 24 * 3600_000);
    for (const offset of [
      (config.POS_EARN_SALE_WINDOW_SECONDS + 60) * 1000,          // paid long after the scan
      -(config.POS_EARN_PAID_BEFORE_SCAN_SECONDS + 60) * 1000,    // paid long before it
    ]) {
      const r = await post(offset);
      expect(r.statusCode, String(offset)).toBe(400);
      expect(r.json().error).toBe('paid_at_outside_ticket_window');
    }
    vi.useRealTimers();
    expect(await points(id)).toBe(0);
    // Inside the window (paid 10 minutes before the scan) the same ticket pays.
    expect((await post(-10 * 60_000)).statusCode).toBe(201);
  });

  it('P1.8c every member-side refusal names itself: token_invalid, token_expired, pos_token_replay, ticket_used', async () => {
    const token = await signIn(app, freshPhone());
    const qr = await till.qr(token, 'earn');
    const [b, sig] = qr.split('.');
    const tampered = await till.scan(`${b}.${sig.slice(0, -1)}${sig.endsWith('A') ? 'B' : 'A'}`);
    expect([tampered.statusCode, tampered.json().error]).toEqual([401, 'token_invalid']);
    const first = await till.scan(qr);
    expect(first.statusCode).toBe(200);
    const replayed = await till.scan(qr);
    expect([replayed.statusCode, replayed.json().error]).toEqual([409, 'pos_token_replay']);
    const stale = await till.qr(token, 'earn');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + (config.POS_TOKEN_TTL_SECONDS + 5) * 1000);
    const expired = await till.scan(stale);
    vi.useRealTimers();
    expect([expired.statusCode, expired.json().error]).toEqual([401, 'token_expired']);
    const ticket = first.json().earnTicket as string;
    await till.earn({ earnTicket: ticket, posOrderRef: `Shop/${randomUUID()}`, branchId: 'b1', paidTotal: 3 });
    const reused = await till.earn({ earnTicket: ticket, posOrderRef: `Shop/${randomUUID()}`, branchId: 'b1', paidTotal: 3 });
    expect([reused.statusCode, reused.json().error]).toEqual([409, 'ticket_used']);
  });

  it('P1.9 🔴 a corporate member earns ZERO even with a ticket from before they joined the roster — the window still counts', async () => {
    const phone = freshPhone();
    const token = await signIn(app, phone);
    const ticket = (await till.scan(await till.qr(token, 'pay'))).json().earnTicket as string;
    await backend.saveCompany({ id: `late${phone}`, nameAr: 'شركة', nameEn: 'Co', percentOff: 50, active: true });
    await backend.replaceRoster(`late${phone}`, [{ phone, companyId: `late${phone}` }]);
    const r = await till.earn({ earnTicket: ticket, posOrderRef: `Shop/${randomUUID()}`, branchId: 'b1', paidTotal: 40 });
    expect(r.statusCode).toBe(201);
    expect(r.json().pointsEarned).toBe(0);
    expect(await points(subOf(token))).toBe(0);
    expect((await backend.getStanding(subOf(token))).windowSpend).toBe(40);
  });

  it('P1.10 bounds the body: fils precision, sign, reference length, paidAt in the future or a day old', async () => {
    const { id, ticket } = await memberAtTill();
    const ok = { earnTicket: ticket, posOrderRef: `Shop/${randomUUID()}`, branchId: 'b1', paidTotal: 5 };
    for (const bad of [
      { paidTotal: 5.0001 }, { paidTotal: -1 }, { paidTotal: 1e9 }, { posOrderRef: '' }, { posOrderRef: 'x'.repeat(65) },
      { branchId: '' }, { paidAt: 'yesterday' },
      // Naive: no offset. "10:15" is a different instant in Amman and in UTC.
      { paidAt: '2026-09-23T10:15:00' }, { paidAt: '2026-09-23' },
      { paidAt: new Date(Date.now() + 10 * 60_000).toISOString() },
      { paidAt: new Date(Date.now() - 25 * 3600_000).toISOString() },
    ]) {
      const r = await till.earn({ ...ok, ...bad });
      expect(r.statusCode, JSON.stringify(bad)).toBe(400);
    }
    expect(await points(id)).toBe(0);
    // UTC with Z (what the Odoo addon sends) and an explicit +03:00 both parse.
    const amman = new Date(Date.now() - 60_000);
    const plus3 = new Date(amman.getTime() + 3 * 3600_000).toISOString().replace('Z', '+03:00');
    expect((await till.earn({ ...ok, paidAt: plus3 })).statusCode).toBe(201);
    const { ticket: t2 } = await memberAtTill();
    expect((await till.earn({ ...ok, earnTicket: t2, posOrderRef: `Shop/${randomUUID()}`, paidAt: amman.toISOString() })).statusCode).toBe(201);
  });

  it('P1.11 🔴 production still pays the till (the till IS the payment confirmation) — while an app "cash" order pays 0', async () => {
    const { id, ticket } = await memberAtTill();
    cfg.NODE_ENV = 'production';
    cfg.DATABASE_URL = 'postgres://production.example/almond';
    const r = await till.earn({ earnTicket: ticket, posOrderRef: `Shop/${randomUUID()}`, branchId: 'b1', paidTotal: 30 });
    expect(r.statusCode).toBe(201);
    expect(r.json().pointsEarned).toBeGreaterThan(0);
    expect(await points(id)).toBe(r.json().pointsEarned);
  });

  it('P1.12 reversal: the points come back out once; a replay is stored; unknown is 404; the reason is required', async () => {
    const { id, ticket } = await memberAtTill();
    const ref = `Shop/${randomUUID()}`;
    const earned = (await till.earn({ earnTicket: ticket, posOrderRef: ref, branchId: 'b1', paidTotal: 25 })).json();
    expect((await till.reverse({ posOrderRef: ref })).statusCode).toBe(400);
    expect((await till.reverse({ posOrderRef: ref, reason: 'refund' }, null)).statusCode).toBe(401);
    const r = await till.reverse({ posOrderRef: ref, reason: 'refund' });
    expect(r.statusCode).toBe(201);
    expect(r.json()).toEqual({
      posOrderRef: ref, refundRef: null, reversedPoints: earned.pointsEarned, shortfall: 0, pointsBalance: 0,
      refundedTotal: 25, fullyReversed: true, replay: false,
    });
    const again = await till.reverse({ posOrderRef: ref, reason: 'refund' });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual({ ...r.json(), replay: true });
    expect(await points(id)).toBe(0);
    expect((await backend.getStanding(id)).windowSpend).toBe(0);
    const unknown = await till.reverse({ posOrderRef: 'Shop/none', reason: 'refund' });
    expect(unknown.statusCode).toBe(404);
    // A reversed sale replays its EARN answer unchanged (the till retried the
    // earn after reversing it) and grants nothing.
    const earnAgain = await till.earn({ earnTicket: ticket, posOrderRef: ref, branchId: 'b1', paidTotal: 25 });
    expect(earnAgain.json()).toEqual({ ...earned, replay: true });
    expect(await points(id)).toBe(0);
  });

  it('P1.14 🔴 a PARTIAL refund takes back only the refunded part, by its own reference; the full reversal takes the rest', async () => {
    const { id, ticket } = await memberAtTill();
    const ref = `Shop/${randomUUID()}`;
    const earned = (await till.earn({ earnTicket: ticket, posOrderRef: ref, branchId: 'b1', paidTotal: 20 })).json();
    expect(earned.pointsEarned).toBe(40);                                      // 20 JOD, entry rung
    const part = { posOrderRef: ref, reason: 'croissant returned', refundRef: `${ref}/R1`, refundedTotal: 2.5 };
    const r = await till.reverse(part);
    expect(r.statusCode).toBe(201);
    expect(r.json()).toEqual({
      posOrderRef: ref, refundRef: `${ref}/R1`, reversedPoints: 5, shortfall: 0, pointsBalance: 35,
      refundedTotal: 2.5, fullyReversed: false, replay: false,
    });
    expect((await backend.getStanding(id)).windowSpend).toBe(17.5);
    const again = await till.reverse(part);
    expect([again.statusCode, again.json()]).toEqual([200, { ...r.json(), replay: true }]);
    const reused = await till.reverse({ ...part, refundedTotal: 3 });
    expect([reused.statusCode, reused.json().error]).toEqual([409, 'refund_conflict']);
    const tooMuch = await till.reverse({ ...part, refundRef: `${ref}/R2`, refundedTotal: 17.501 });
    expect([tooMuch.statusCode, tooMuch.json().error]).toEqual([409, 'refund_exceeds_sale']);
    // Both or neither; money in whole fils, and more than nothing.
    for (const bad of [
      { refundRef: `${ref}/R3` }, { refundedTotal: 1 }, { refundRef: `${ref}/R3`, refundedTotal: 0 },
      { refundRef: `${ref}/R3`, refundedTotal: 1.0001 }, { refundRef: `${ref}/R3`, refundedTotal: -1 },
      { refundRef: '', refundedTotal: 1 }, { refundRef: 'x'.repeat(65), refundedTotal: 1 },
    ]) {
      const b = await till.reverse({ posOrderRef: ref, reason: 'x', ...bad });
      expect(b.statusCode, JSON.stringify(bad)).toBe(400);
    }
    expect(await points(id)).toBe(35);
    const full = await till.reverse({ posOrderRef: ref, reason: 'rest' });
    expect(full.json()).toEqual({
      posOrderRef: ref, refundRef: null, reversedPoints: 35, shortfall: 0, pointsBalance: 0,
      refundedTotal: 20, fullyReversed: true, replay: false,
    });
    const after = await till.reverse({ ...part, refundRef: `${ref}/R4` });
    expect([after.statusCode, after.json().error]).toEqual([409, 'sale_already_reversed']);
    expect(await points(id)).toBe(0);
    expect((await backend.getStanding(id)).windowSpend).toBe(0);
  });

  it('P1.13 the till routes are rate-limited per till AND per POS key — earning and settling apart', async () => {
    const run = async (n: number, f: (i: number) => Promise<{ statusCode: number }>) => {
      const out: number[] = [];
      for (let i = 0; i < n; i += 1) out.push((await f(i)).statusCode);
      return out;
    };
    const reverse = (i: number) => till.reverse({ posOrderRef: `Shop/none-${i}`, reason: 'x' });
    const settle = (i: number) => app.inject({
      method: 'POST', url: '/v1/pos/redemption/settle', headers: { 'x-pos-key': KEY }, payload: { code: `ZZZZ${2000 + i}` },
    });
    cfg.RATE_LIMITS = { ...saved.RATE_LIMITS, posEarnPerTill: { max: 3, windowSeconds: 60 } };
    expect(await run(5, reverse)).toEqual([404, 404, 404, 429, 429]);
    __resetRateLimits();
    // The per-KEY ceiling bounds the chain, whatever till (address) asks.
    cfg.RATE_LIMITS = { ...saved.RATE_LIMITS, posSettlePerKey: { max: 4, windowSeconds: 60 } };
    expect(await run(6, settle)).toEqual([404, 404, 404, 404, 429, 429]);
    // A code-guessing flood on /settle does not stop the chain earning.
    expect((await reverse(99)).statusCode).toBe(404);
    // An unauthenticated caller spends no budget at all.
    __resetRateLimits();
    cfg.RATE_LIMITS = { ...saved.RATE_LIMITS, posEarnPerKey: { max: 2, windowSeconds: 60 } };
    for (let i = 0; i < 5; i += 1) expect((await till.reverse({ posOrderRef: 'x', reason: 'x' }, 'wrong'.padEnd(40, 'w'))).statusCode).toBe(401);
    expect(await run(3, reverse)).toEqual([404, 404, 429]);
  });
});
