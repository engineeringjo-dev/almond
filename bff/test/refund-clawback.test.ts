import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { liveBalance } from '@almond/shared/loyalty/lots';
import { config } from '@almond/shared/config';
import { createMemoryBackend } from '../src/backend/memory';
import { createPostgresBackend } from '../src/backend/postgres';
import { fromPglite, type Db } from '../src/backend/db';
import type { Backend, TillEarnInput } from '../src/backend/types';
import { loyaltySchemaSql, readMigration } from './lib/schema';

let serial = 1;
describe.each(['memory', 'postgres'] as const)('purchase refund recovery — %s', (kind) => {
  let pg: PGlite | undefined;
  let db: Db | undefined;
  let backend: Backend;
  beforeAll(async () => {
    if (kind === 'postgres') {
      pg = new PGlite(); await pg.waitReady; await pg.exec(loyaltySchemaSql()); db = fromPglite(pg);
    }
  });
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-16T10:00:00Z'));
    backend = db ? createPostgresBackend(db) : createMemoryBackend();
  });
  afterEach(() => vi.useRealTimers());
  afterAll(async () => { await pg?.close(); });
  const member = async () => (await backend.findOrCreateByPhone(`+962791${String(serial++).padStart(6, '0')}`)).id;
  const earn = async (id: string, points = 40) => {
    const ref = `sale-${serial++}`;
    const input: TillEarnInput = { posOrderRef: ref, memberId: id, ticketJti: ref, ticketRefusal: null,
      branchId: 'test', paidFils: 1000, paidAt: new Date(), pointsEarned: points, earn: null,
      spendJod: 1, spendDay: null, reasonAr: 'شراء', reasonEn: 'Purchase', at: new Date() };
    await backend.tillEarn(input); return ref;
  };
  const points = async (id: string) => liveBalance((await backend.getMember(id)).lots);

  it('refund closes every unused held code atomically, so later cancel cannot restore refunded earning', async () => {
    const id = await member(); const sale = await earn(id);
    const a = await backend.createRedemption(id, 20); const b = await backend.createRedemption(id, 20);
    const refunded = await backend.reverseTillEarn(sale, 'returned', new Date());
    expect(refunded.refund).toMatchObject({ reversedPoints: 40, shortfall: 0 });
    await backend.cancelRedemption(id, a.id, new Date()); await backend.cancelRedemption(id, b.id, new Date());
    expect(await points(id)).toBe(0);
    await expect(backend.settleRedemption(a.id, 'pos', new Date())).rejects.toMatchObject({ code: 'redemption_cancelled' });
  });

  it('transferred then refunded purchase creates durable recovery; all later credits offset it exactly once', async () => {
    const id = await member(); const friend = await member(); const sale = await earn(id);
    await backend.transfer({ senderId: id, recipientId: friend, kind: 'points', amount: 40, at: new Date() });
    const refunded = await backend.reverseTillEarn(sale, 'returned', new Date());
    expect(refunded.refund.shortfall).toBe(40);
    expect((await backend.getMember(id)).purchasePointsDebt).toBe(40);
    if (db) backend = createPostgresBackend(db);
    await backend.reverseTillEarn(sale, 'retry', new Date());
    await backend.transfer({ senderId: friend, recipientId: id, kind: 'points', amount: 15, at: new Date() });
    expect(await points(id)).toBe(0);
    expect((await backend.getMember(id)).purchasePointsDebt).toBe(25);
    const result = await backend.setProfile(id, { name: 'أحمد', birthday: '1990-01-01', gender: 'male' });
    expect(result).toMatchObject({ bonusGranted: 50, bonusAvailablePoints: 25, bonusRecoveredPoints: 25, pointsBalance: 25 });
    expect((await backend.getMember(id)).purchasePointsDebt).toBe(0);
    expect(await points(friend)).toBe(25);
    expect((await backend.getHistory(id)).reduce((n, h) => n + h.deltaPoints, 0)).toBe(25);
  });

  it('expired unused reserved points with exact purchase provenance never create recovery or affect unrelated gifts', async () => {
    const id = await member(); const sale = await earn(id);
    const code = await backend.createRedemption(id, 40);
    vi.setSystemTime(new Date('2027-10-17T10:00:00Z'));
    const refunded = await backend.reverseTillEarn(sale, 'returned', new Date());
    expect(refunded.refund).toMatchObject({ reversedPoints: 0, shortfall: 0, expiredReservedPoints: 40, reconciliationRequired: false });
    expect((await backend.getMember(id)).purchasePointsDebt).toBe(0);
    expect(await points(id)).toBe(0);
    await backend.cancelRedemption(id, code.id, new Date());
    await backend.addPoints(id, 10, 'هدية', 'Gift');
    expect(await points(id)).toBe(10);
  });

  it('partial refunds consume proven expired-reservation exemption once and cumulative totals account for every point', async () => {
    const id = await member(); const sale = await earn(id);
    await backend.createRedemption(id, 40);
    vi.setSystemTime(new Date('2027-10-17T10:00:00Z'));
    const first = await backend.reverseTillEarn(sale, 'half', new Date(), { refundRef: `refund-${serial++}`, refundedFils: 500 });
    const last = await backend.reverseTillEarn(sale, 'rest', new Date());
    expect(first.refund.expiredReservedPoints).toBe(20);
    expect(last.refund.expiredReservedPoints).toBe(20);
    expect(last.sale).toMatchObject({ reversedPoints: 0, shortfall: 0, expiredReservedPoints: 40 });
    expect((await backend.getMember(id)).purchasePointsDebt).toBe(0);
  });

  it('unused direct purchase expiry remains evidence after retention pruning and never charges a later gift', async () => {
    const id = await member(); const sale = await earn(id);
    vi.setSystemTime(new Date('2028-02-01T10:00:00Z'));
    // This settles expiry and invokes ordinary pruning long after its window.
    await backend.addPoints(id, 10, 'هدية', 'Gift');
    const refunded = await backend.reverseTillEarn(sale, 'returned', new Date());
    expect(refunded.refund).toMatchObject({ reversedPoints: 0, shortfall: 0, expiredReservedPoints: 40 });
    expect(await points(id)).toBe(10);
    expect((await backend.getMember(id)).purchasePointsDebt).toBe(0);
  });

  it('a profile gift keeps its gross once-only award but reports actual net availability', async () => {
    const id = await member(); const friend = await member(); const sale = await earn(id);
    await backend.transfer({ senderId: id, recipientId: friend, kind: 'points', amount: 40, at: new Date() });
    await backend.reverseTillEarn(sale, 'returned', new Date());
    const profile = { name: 'أحمد', birthday: '1990-01-01', gender: 'male' as const };
    expect(await backend.setProfile(id, profile)).toMatchObject({
      bonusGranted: 50, bonusAvailablePoints: 10, bonusRecoveredPoints: 40, pointsBalance: 10,
    });
    expect(await backend.setProfile(id, profile)).toMatchObject({
      bonusGranted: 0, bonusAvailablePoints: 0, bonusRecoveredPoints: 0, pointsBalance: 10,
    });
  });

  it('referral gross lifetime awards remain immutable while their actual credit settles earlier purchase points', async () => {
    const id = await member(); const other = await member(); const invited = await member();
    for (const who of [id, invited]) {
      await backend.verifyMemberPhone(who, (await backend.getMember(who)).phone, new Date());
    }
    const sale = await earn(id);
    await backend.transfer({ senderId: id, recipientId: other, kind: 'points', amount: 40, at: new Date() });
    await backend.reverseTillEarn(sale, 'returned', new Date());
    await backend.attachReferral(invited, (await backend.getReferral(id)).code, new Date());
    const friendSale = await earn(invited, 0);
    expect((await backend.getReferral(id)).pointsEarned).toBe(config.REFERRAL_REWARD_POINTS);
    expect(await points(id)).toBe(config.REFERRAL_REWARD_POINTS - 40);
    expect((await backend.getMember(id)).purchasePointsDebt).toBe(0);
    await backend.reverseTillEarn(friendSale, 'returned friend purchase', new Date());
    expect((await backend.getReferral(id)).pointsEarned).toBe(config.REFERRAL_REWARD_POINTS);
    expect(await points(id)).toBe(config.REFERRAL_REWARD_POINTS - 40);
  });

  it('future purchase earning settles shortfall and refunding that purchase restores its adjustment once', async () => {
    const id = await member(); const friend = await member(); const sale = await earn(id);
    await backend.transfer({ senderId: id, recipientId: friend, kind: 'points', amount: 40, at: new Date() });
    await backend.reverseTillEarn(sale, 'returned', new Date());
    const second = await earn(id, 30);
    expect(await points(id)).toBe(0);
    expect((await backend.getMember(id)).purchasePointsDebt).toBe(10);
    expect(await backend.getPendingVisit(id, new Date())).toMatchObject({ points: 0 });
    expect(await backend.getTillSale(second)).toMatchObject({ pointsEarned: 30, pointsAvailable: 0, pointsRecovered: 30 });
    await backend.reverseTillEarn(second, 'returned too', new Date());
    await backend.reverseTillEarn(second, 'retry', new Date());
    expect((await backend.getMember(id)).purchasePointsDebt).toBe(40);
    expect(await backend.addPoints(id, 50, 'هدية', 'Gift')).toBe(10);
    expect((await backend.getMember(id)).purchasePointsDebt).toBe(0);
  });

  it('voiding a previously used points tender settles shortfall without cash or wallet changes', async () => {
    const id = await member(); const sale = await earn(id); const ref = `spend-${serial++}`;
    await backend.topUpWallet(id, 5000);
    await backend.tillSpend({ memberId: id, posOrderRef: ref, ticketJti: ref, ticketExpired: false, points: 40,
      valueJod: 0.4, reasonAr: 'صرف', reasonEn: 'Spent', at: new Date() });
    await backend.reverseTillEarn(sale, 'returned', new Date());
    const voided = await backend.reverseTillSpend(ref, 'voided', new Date());
    expect(voided.spend).toMatchObject({ returnedPoints: 0, expiredPoints: 0, recoveredPoints: 40 });
    expect(await points(id)).toBe(0);
    expect((await backend.getMember(id)).purchasePointsDebt).toBe(0);
    expect(liveBalance((await backend.getMember(id)).walletLots)).toBe(5000);
    await backend.reverseTillSpend(ref, 'retry', new Date());
    expect(await points(id)).toBe(0);
  });

  it('proven expired points in an already-voided POS tender exempt only their original purchase', async () => {
    const id = await member(); const sale = await earn(id); const ref = `expired-spend-${serial++}`;
    await backend.tillSpend({ memberId: id, posOrderRef: ref, ticketJti: ref, ticketExpired: false, points: 40,
      valueJod: 0.4, reasonAr: 'صرف', reasonEn: 'Spent', at: new Date() });
    vi.setSystemTime(new Date('2027-10-17T10:00:00Z'));
    await backend.addPoints(id, 10, 'هدية', 'Gift');
    expect((await backend.reverseTillSpend(ref, 'voided unused', new Date())).spend)
      .toMatchObject({ returnedPoints: 0, expiredPoints: 40 });
    const refund = await backend.reverseTillEarn(sale, 'original returned', new Date());
    expect(refund.refund).toMatchObject({ reversedPoints: 0, shortfall: 0, expiredReservedPoints: 40 });
    expect(await points(id)).toBe(10);
    expect((await backend.getMember(id)).purchasePointsDebt).toBe(0);
  });

  it('refund/cancel races and duplicate refunds cannot leave spendable refunded earning', async () => {
    const id = await member(); const sale = await earn(id); const code = await backend.createRedemption(id, 40);
    await Promise.all([
      backend.cancelRedemption(id, code.id, new Date()),
      backend.reverseTillEarn(sale, 'returned', new Date()),
      backend.reverseTillEarn(sale, 'retry', new Date()),
    ]);
    expect(await points(id)).toBe(0);
    expect((await backend.getMember(id)).purchasePointsDebt).toBe(0);
    expect((await backend.getHistory(id)).filter((h) => h.sourceRef === `redemption:${code.id}` && h.kind === 'return')).toHaveLength(1);
  });

  it.skipIf(kind === 'memory')('an unknown expired legacy reservation is explicit review work, never guessed as an exemption', async () => {
    const id = await member(); const sale = await earn(id); const code = await backend.createRedemption(id, 40);
    if (db) await db.query('update redemptions set slices=null where id=$1', [code.id]);
    vi.setSystemTime(new Date('2027-10-17T10:00:00Z'));
    const refunded = await backend.reverseTillEarn(sale, 'returned', new Date());
    expect(refunded.refund).toMatchObject({ expiredReservedPoints: 0, shortfall: 40, reconciliationRequired: true });
    expect((await backend.getRedemption(id, code.id))?.refundReviewRequired).toBe(true);
  });

  it.skipIf(kind === 'memory')('a failure after closing held value rolls the whole refund back; owner lock precedes stable redemption locks', async () => {
    const id = await member(); const sale = await earn(id); const code = await backend.createRedemption(id, 40);
    const queries: string[] = [];
    const wrap = (handle: Db): Db => ({
      async query<T>(sql: string, params?: unknown[]) {
        queries.push(sql.replace(/\s+/g, ' ').trim());
        if (/insert into pos_sale_refunds/.test(sql)) throw new Error('simulated durable refund write failure');
        return handle.query<T>(sql, params);
      },
      tx: (fn) => handle.tx((t) => fn(wrap(t))),
    });
    const failing = createPostgresBackend(wrap(db!));
    await expect(failing.reverseTillEarn(sale, 'returned', new Date())).rejects.toThrow('simulated');
    expect((await backend.getRedemption(id, code.id))?.cancelledAt).toBeNull();
    expect((await backend.getTillSale(sale))?.status).toBe('earned');
    expect((await backend.getMember(id)).purchasePointsDebt).toBe(0);
    expect(await points(id)).toBe(0); // still held, never both held and credited
    expect((await backend.getHistory(id)).filter((h) => h.kind === 'return')).toHaveLength(0);
    const ownerLock = queries.findIndex((sql) => /from members.*for no key update/.test(sql));
    const redemptionLock = queries.findIndex((sql) => /from redemptions.*order by id for update/.test(sql));
    expect(ownerLock).toBeGreaterThanOrEqual(0); expect(redemptionLock).toBeGreaterThan(ownerLock);
    await backend.reverseTillEarn(sale, 'returned', new Date());
    expect(await points(id)).toBe(0);
  });
});

it('purchase recovery survives disk close/reopen, migration retry, and duplicate refund delivery', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'almond-purchase-recovery-'));
  let pg: PGlite | undefined;
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-16T10:00:00Z'));
  try {
    pg = new PGlite(dir); await pg.waitReady; await pg.exec(loyaltySchemaSql());
    let b = createPostgresBackend(fromPglite(pg));
    const id = (await b.findOrCreateByPhone('+962791777777')).id;
    const friend = (await b.findOrCreateByPhone('+962791777778')).id;
    const ref = 'durable-recovery';
    await b.tillEarn({ posOrderRef: ref, memberId: id, ticketJti: ref, ticketRefusal: null,
      branchId: 'test', paidFils: 1000, paidAt: new Date(), pointsEarned: 40, earn: null,
      spendJod: 1, spendDay: null, reasonAr: 'شراء', reasonEn: 'Purchase', at: new Date() });
    await b.transfer({ senderId: id, recipientId: friend, kind: 'points', amount: 40, at: new Date() });
    const first = await b.reverseTillEarn(ref, 'returned', new Date());
    await pg.close(); pg = new PGlite(dir); await pg.waitReady;
    await pg.exec(readMigration('20261016160234_purchase_points_recovery.sql'));
    b = createPostgresBackend(fromPglite(pg));
    expect((await b.getMember(id)).purchasePointsDebt).toBe(40);
    expect((await b.reverseTillEarn(ref, 'retry', new Date())).refund).toEqual(first.refund);
    await b.addPoints(id, 50, 'هدية', 'Gift');
    expect(liveBalance((await b.getMember(id)).lots)).toBe(10);
    expect((await b.getMember(id)).purchasePointsDebt).toBe(0);
  } finally { await pg?.close(); rmSync(dir, { recursive: true, force: true }); vi.useRealTimers(); }
});
