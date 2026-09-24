import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { config as loyalty } from '@almond/shared/config';
import { ammanDayKey } from '@almond/shared/lib/ammanWeekday';
import { addMonthsToDayKey, liveBalance, type PointLot } from '@almond/shared/loyalty/lots';
import { shiftDayKey } from '@almond/shared/loyalty/window';
import { maskedDisplayName } from '@almond/shared/loyalty/profile';
import { transferRefusal, transferRemainingToday, transferRulesFromConfig } from '@almond/shared/loyalty/transfer';
import { config } from '../src/config';
import { build } from '../src/server';
import { createMemoryBackend } from '../src/backend/memory';
import { createPostgresBackend } from '../src/backend/postgres';
import type { Db } from '../src/backend/db';
import type { Backend } from '../src/backend';
import { __resetRateLimits } from '../src/plugins/rateLimit';
import { __resetOtpState } from '../src/auth/otp';
import { pgTestDb } from './lib/pgTestDb';
import { signIn } from './lib/signIn';

/**
 * X — TRANSFERS TO A FRIEND. Owner, 2026-09-24: points AND wallet balance, to a
 * REGISTERED member only, found by phone (a masked name to confirm), with a
 * daily cap per sender.
 *
 * The backend contract (backend-contract.test.ts) proves the money moves; the
 * concurrency suite proves two transfers cannot overdraw or deadlock. This file
 * proves what those two cannot see: that a transferred point keeps the expiry
 * it was granted with (a BACK-DATED lot is needed, which only a store-level
 * seed can make), and the HTTP surface — the masked preview, the refusals'
 * codes, the Idempotency-Key and the rate limit.
 */

type Mutable = Record<string, unknown>;
const cfg = config as unknown as Mutable;
const savedLimits = config.RATE_LIMITS;

let seq = 0;
const fresh = () => {
  const d = String(6_000_000 + seq++).padStart(7, '0');
  return { canonical: `+96279${d}`, local: `079${d}` };
};

beforeEach(() => { __resetRateLimits(); __resetOtpState(); });
afterEach(() => { cfg.RATE_LIMITS = savedLimits; });

describe('X0 the shared rule', () => {
  const R = transferRulesFromConfig();

  it('X0.1 the cap is per sender per day, in the ledger\'s units, and fails closed on a zero dial', () => {
    expect(R.walletDailyMaxFils).toBe(loyalty.TRANSFER_WALLET_DAILY_MAX_JOD * 1000);
    const base = { kind: 'points' as const, amount: 100, sentToday: 0, senderId: 'a', recipientId: 'b' };
    expect(transferRefusal(base)).toBeNull();
    expect(transferRefusal({ ...base, recipientId: 'a' })).toBe('transfer_to_self');
    expect(transferRefusal({ ...base, amount: R.pointsMin - 1 })).toBe('transfer_below_min');
    expect(transferRefusal({ ...base, amount: 10.5 })).toBe('transfer_below_min');   // whole points only
    expect(transferRefusal({ ...base, sentToday: R.pointsDailyMax - 99 })).toBe('transfer_daily_cap');
    expect(transferRefusal({ ...base, sentToday: R.pointsDailyMax - 100 })).toBeNull();
    expect(transferRemainingToday('points', R.pointsDailyMax + 50)).toBe(0);           // never negative
    expect(transferRefusal(base, { ...R, pointsDailyMax: 0 })).toBe('transfer_daily_cap');
  });
});

describe.each([
  ['memory', async () => ({ backend: createMemoryBackend(), db: null as Db | null })],
  ['postgres (pglite)', async () => { const db = await pgTestDb(); return { backend: createPostgresBackend(db), db }; }],
] as [string, () => Promise<{ backend: Backend; db: Db | null }>][])('X transfers — %s', (_name, make) => {
  let app: FastifyInstance;
  let backend: Backend;
  let db: Db | null;
  beforeAll(async () => { ({ backend, db } = await make()); app = await build(backend); }, 60_000);
  afterAll(async () => { await app.close(); });

  const points = async (id: string) => liveBalance((await backend.getMember(id)).lots);
  const wallet = async (id: string) => liveBalance((await backend.getMember(id)).walletLots);

  /** Give a member a lot granted long ago — the only way to see whether a
   *  transfer keeps a lot's clock. Memory hands out the stored row; Postgres
   *  is written directly, as a migration would. */
  async function seedLots(id: string, lots: PointLot[]): Promise<void> {
    if (db) await db.query('update members set lots = $2 where id = $1', [id, JSON.stringify(lots)]);
    else (await backend.getMember(id)).lots = lots;
  }

  it('X1 🔴 transferred points keep their ORIGINAL expiry, oldest first — never a fresh twelve months', async () => {
    const a = (await backend.findOrCreateByPhone(fresh().canonical)).id;
    const b = (await backend.findOrCreateByPhone(fresh().canonical)).id;
    const today = ammanDayKey();
    const old = shiftDayKey(today, -300);
    const mid = shiftDayKey(today, -100);
    await seedLots(a, [
      { seq: 0, grantedOn: old, expiresOn: addMonthsToDayKey(old, 12), amount: 60, remaining: 60, source: 'earn' },
      { seq: 1, grantedOn: mid, expiresOn: addMonthsToDayKey(mid, 12), amount: 100, remaining: 100, source: 'earn' },
    ]);
    const r = await backend.transfer({ senderId: a, recipientId: b, kind: 'points', amount: 80, at: new Date() });
    // FIFO: all 60 of the oldest lot, then 20 of the next — with their dates.
    expect(r.transfer.slices).toEqual([
      { grantedOn: old, expiresOn: addMonthsToDayKey(old, 12), points: 60, source: 'earn' },
      { grantedOn: mid, expiresOn: addMonthsToDayKey(mid, 12), points: 20, source: 'earn' },
    ]);
    const got = (await backend.getMember(b)).lots.map((l) => ({ grantedOn: l.grantedOn, expiresOn: l.expiresOn, remaining: l.remaining }));
    expect(got).toEqual([
      { grantedOn: old, expiresOn: addMonthsToDayKey(old, 12), remaining: 60 },
      { grantedOn: mid, expiresOn: addMonthsToDayKey(mid, 12), remaining: 20 },
    ]);
    // …and the sender's remainder kept its date too (a partial spend never re-dates).
    expect((await backend.getMember(a)).lots.find((l) => l.remaining > 0))
      .toMatchObject({ grantedOn: mid, remaining: 80 });
  });

  // ---- over HTTP ----

  const auth = (token: string, key?: string) => ({
    authorization: `Bearer ${token}`, ...(key ? { 'idempotency-key': key } : {}),
  });
  const enrol = async (name?: string) => {
    const p = fresh();
    const token = await signIn(app, p.local);
    const m = await backend.findOrCreateByPhone(p.canonical);
    if (name) await backend.setProfile(m.id, { name, birthday: null, gender: null });
    return { token, id: m.id, phone: p };
  };
  const preview = (token: string, phone: string) => app.inject({
    method: 'POST', url: '/v1/me/transfers/preview', headers: auth(token), payload: { phone },
  });
  const send = (token: string, payload: Record<string, unknown>, key: string | null = randomUUID()) => app.inject({
    method: 'POST', url: '/v1/me/transfers', headers: auth(token, key ?? undefined), payload,
  });

  it('X2 🔴 the preview shows a MASKED name and never creates a member', async () => {
    const sender = await enrol();
    const friend = await enrol('سارة خالد العموش');
    const r = await preview(sender.token, friend.phone.local);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toEqual({
      recipientFound: true,
      displayName: maskedDisplayName('سارة خالد العموش'),
      remainingToday: { points: loyalty.TRANSFER_POINTS_DAILY_MAX, walletJod: loyalty.TRANSFER_WALLET_DAILY_MAX_JOD },
    });
    expect(r.json().displayName).toBe('سارة ع.');
    // A number nobody has signed in with is refused — and is STILL nobody.
    const stranger = fresh();
    const miss = await preview(sender.token, stranger.local);
    expect(miss.statusCode).toBe(404);
    expect(miss.json().error).toBe('recipient_not_found');
    expect(await backend.findMemberByPhone(stranger.canonical)).toBeNull();
    // Not a Jordanian mobile, and yourself — each its own code.
    expect((await preview(sender.token, '12345')).json().error).toBe('phone_invalid');
    expect((await preview(sender.token, sender.phone.local)).json().error).toBe('transfer_to_self');
  });

  it('X3 🔴 a points transfer over HTTP moves the points once; a replayed key moves nothing more', async () => {
    const sender = await enrol();
    const friend = await enrol('Omar Haddad');
    await backend.addPoints(sender.id, 300, 'منحة', 'Grant');
    const key = randomUUID();
    const body = { phone: friend.phone.local, kind: 'points', amount: 120 };
    const first = await send(sender.token, body, key);
    expect(first.statusCode, first.body).toBe(201);
    expect(first.json()).toMatchObject({
      kind: 'points', amount: 120, recipientDisplayName: 'Omar H.', pointsBalance: 180,
      remainingToday: { kind: 'points', amount: loyalty.TRANSFER_POINTS_DAILY_MAX - 120 },
    });
    const again = await send(sender.token, body, key);
    expect(again.statusCode).toBe(201);
    expect(again.headers['idempotent-replay']).toBe('true');
    expect(again.body).toBe(first.body);
    expect(await points(sender.id)).toBe(180);
    expect(await points(friend.id)).toBe(120);
  });

  it('X4 a wallet transfer takes JOD (to the fils) and answers in JOD', async () => {
    const sender = await enrol();
    const friend = await enrol();
    await backend.creditWallet(sender.id, 10_000, 'topup');
    const r = await send(sender.token, { phone: friend.phone.canonical, kind: 'wallet', amount: 2.5 });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({ kind: 'wallet', amount: 2.5, walletBalance: 7.5, recipientDisplayName: null });
    expect(await wallet(friend.id)).toBe(2_500);
    expect((await send(sender.token, { phone: friend.phone.local, kind: 'wallet', amount: 1.2345 })).statusCode).toBe(400);
  });

  it('X5 🔴 every refusal has its own machine code, and none moves anything', async () => {
    const sender = await enrol();
    const friend = await enrol();
    await backend.addPoints(sender.id, 100, 'منحة', 'Grant');
    const codeOf = async (payload: Record<string, unknown>) => (await send(sender.token, payload)).json().error;
    expect(await codeOf({ phone: friend.phone.local, kind: 'points', amount: 101 })).toBe('insufficient_points');
    expect(await codeOf({ phone: friend.phone.local, kind: 'wallet', amount: 1 })).toBe('insufficient_wallet');
    expect(await codeOf({ phone: friend.phone.local, kind: 'points', amount: 1 })).toBe('transfer_below_min');
    expect(await codeOf({ phone: sender.phone.local, kind: 'points', amount: 50 })).toBe('transfer_to_self');
    expect(await codeOf({ phone: fresh().local, kind: 'points', amount: 50 })).toBe('recipient_not_found');
    expect(await codeOf({ phone: friend.phone.local, kind: 'points', amount: loyalty.TRANSFER_POINTS_DAILY_MAX + 1 }))
      .toBe('transfer_daily_cap');
    expect(await points(sender.id)).toBe(100);
    expect(await points(friend.id)).toBe(0);
    // No Idempotency-Key, no transfer.
    const noKey = await send(sender.token, { phone: friend.phone.local, kind: 'points', amount: 50 }, null);
    expect(noKey.statusCode).toBe(400);
    expect(noKey.json().error).toBe('idempotency_key_required');
    expect(await points(friend.id)).toBe(0);
  });

  it('X6 the preview and the send are rate-limited per member', async () => {
    cfg.RATE_LIMITS = {
      ...savedLimits,
      transferPreviewPerMember: { max: 2, windowSeconds: 60 },
      transferPerMember: { max: 1, windowSeconds: 60 },
    };
    const sender = await enrol();
    const friend = await enrol();
    await backend.addPoints(sender.id, 500, 'منحة', 'Grant');
    expect((await preview(sender.token, friend.phone.local)).statusCode).toBe(200);
    expect((await preview(sender.token, friend.phone.local)).statusCode).toBe(200);
    const third = await preview(sender.token, friend.phone.local);
    expect(third.statusCode).toBe(429);
    expect(third.json().error).toBe('rate_limited');
    expect((await send(sender.token, { phone: friend.phone.local, kind: 'points', amount: 20 })).statusCode).toBe(201);
    expect((await send(sender.token, { phone: friend.phone.local, kind: 'points', amount: 20 })).statusCode).toBe(429);
    expect(await points(friend.id)).toBe(20);
  });

  it('X7 a transfer is not spend: neither member moves toward a tier', async () => {
    const sender = await enrol();
    const friend = await enrol();
    await backend.creditWallet(sender.id, 20_000, 'topup');
    await send(sender.token, { phone: friend.phone.local, kind: 'wallet', amount: 20 });
    const s = await backend.getStanding(sender.id);
    const f = await backend.getStanding(friend.id);
    expect([s.windowSpend, s.visitDays, f.windowSpend, f.visitDays]).toEqual([0, 0, 0, 0]);
  });
});
