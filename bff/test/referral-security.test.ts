import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { config as loyalty } from '@almond/shared/config';
import { liveBalance } from '@almond/shared/loyalty/lots';
import { assignHoldout, holdoutSpecFromConfig } from '@almond/shared/loyalty/holdout';
import { createMemoryBackend } from '../src/backend/memory';
import { createPostgresBackend } from '../src/backend/postgres';
import type { Backend } from '../src/backend';
import type { CheckoutInput, TillEarnInput } from '../src/backend/types';
import type { Db } from '../src/backend/db';
import { pgTestDb } from './lib/pgTestDb';
import { readMigration } from './lib/schema';
import { SHIPPED_WELCOME_BONUS_POINTS, withWelcomeGift } from '../../packages/shared/test-setup/no-welcome-gift';

const AT = new Date('2026-10-16T12:00:00.000Z');
const checkout = (id: string, spendJod: number | null = 3, at = AT): CheckoutInput => ({
  order: { branchId: 'b1', type: 'pickup', paymentMethod: 'cash', subtotal: spendJod ?? 3, tax: 0, total: spendJod ?? 3 },
  walletDebitFils: 0, pointsEarned: 0, pointsReasonAr: 'شراء', pointsReasonEn: 'Purchase',
  earn: null, spendJod, corporateUse: null,
  secondVisit: { basketHasDrink: false, arm: assignHoldout(id, holdoutSpecFromConfig('secondVisitVoucher')) },
  at,
});
const tillSale = (id: string, paidFils: number): TillEarnInput => ({
  posOrderRef: `RF/${randomUUID()}`, memberId: id, ticketJti: randomUUID(), ticketRefusal: null,
  branchId: 'b1', paidFils, paidAt: AT, at: AT, pointsEarned: 0, earn: null,
  spendJod: paidFils > 0 ? paidFils / 1000 : null, spendDay: paidFils > 0 ? '2026-10-16' : null,
  reasonAr: 'شراء', reasonEn: 'Purchase',
});

describe.each(['memory', 'postgres'] as const)('RF security — %s', (kind) => {
  let backend: Backend;
  let db: Db | undefined;
  let seq: number;
  beforeEach(async () => {
    seq = 0;
    db = kind === 'postgres' ? await pgTestDb() : undefined;
    backend = db ? createPostgresBackend(db) : createMemoryBackend();
  });
  const member = async (verified = true, phone = `+96279${String(++seq).padStart(7, '0')}`) => {
    const m = await backend.findOrCreateByPhone(phone);
    if (verified) await backend.verifyMemberPhone(m.id, phone, AT);
    return m.id;
  };
  const attach = async (referrer: string, friend: string) =>
    backend.attachReferral(friend, (await backend.getReferral(referrer)).code, AT);
  const paidTotal = async (id: string) => (await backend.getReferral(id)).pointsEarned;

  it('RF-S1 canonical phone shape is not OTP proof: both parties need verified Jordanian mobiles', async () => {
    const referrer = await member();
    const friend = await member(false);
    expect((await backend.getMember(friend)).phoneVerifiedAt).toBeNull();
    await expect(attach(referrer, friend)).rejects.toMatchObject({ code: 'referral_phone_unverified' });
    expect(await backend.getReferralOf(friend)).toBeNull();
    const unverifiedInviter = await member(false);
    await expect(attach(unverifiedInviter, referrer)).rejects.toMatchObject({ code: 'referral_phone_unverified' });
    const foreign = await member(false, '+971501234567');
    await expect(backend.verifyMemberPhone(foreign, '+971501234567', AT))
      .rejects.toMatchObject({ code: 'phone_verification_mismatch' });
    await expect(backend.verifyMemberPhone(friend, '+962790000099', AT))
      .rejects.toMatchObject({ code: 'phone_verification_mismatch' });
    expect((await backend.getMember(friend)).phoneVerifiedAt).toBeNull();
    await backend.verifyMemberPhone(friend, (await backend.getMember(friend)).phone, AT);
    expect((await attach(referrer, friend)).replay).toBe(false);
    expect(await paidTotal(referrer)).toBe(0);
  });

  it('RF-S2 free, points-only and unfunded orders do not qualify; one positive payment does, once', async () => {
    const referrer = await member();
    const friend = await member();
    await attach(referrer, friend);
    await withWelcomeGift(async () => {
      await backend.checkout(friend, checkout(friend, null));
      await backend.checkout(friend, checkout(friend, 0));
      await backend.tillEarn(tillSale(friend, 0));
      expect(await paidTotal(referrer)).toBe(0);
      expect((await backend.getMember(friend)).firstPaidAt).toBeNull();
      expect((await backend.getMember(friend)).welcomeBonusAt).toBeNull();
      expect(liveBalance((await backend.getMember(friend)).lots, AT)).toBe(0);
      // No minimum purchase was specified: even a positive fils is paid.
      const input = tillSale(friend, 1);
      await backend.tillEarn(input);
      await backend.tillEarn(input);
      await backend.checkout(friend, checkout(friend));
      expect(await paidTotal(referrer)).toBe(loyalty.REFERRAL_REWARD_POINTS);
      expect(liveBalance((await backend.getMember(friend)).lots, AT)).toBe(SHIPPED_WELCOME_BONUS_POINTS);
    });
  });

  it('RF-S3 different friends racing cannot exceed the single 500-point lifetime budget', async () => {
    const referrer = await member();
    const friends = await Promise.all(Array.from({ length: 14 }, () => member()));
    await Promise.all(friends.map((id) => attach(referrer, id)));
    // Mix the two settlement paths; both must consume the SAME budget.
    await Promise.all(friends.map((id, i) => i % 2
      ? backend.checkout(id, checkout(id)) : backend.tillEarn(tillSale(id, 3000))));
    const grants = await Promise.all(friends.map((id) => backend.getReferralOf(id)));
    expect(grants.every((r) => r?.rewardedAt !== null)).toBe(true);
    expect(grants.filter((r) => r?.rewardPoints === loyalty.REFERRAL_REWARD_POINTS)).toHaveLength(10);
    expect(grants.filter((r) => r?.rewardPoints === 0)).toHaveLength(4);
    expect(await paidTotal(referrer)).toBe(loyalty.REFERRAL_LIFETIME_CAP_POINTS);
    expect(liveBalance((await backend.getMember(referrer)).lots, AT)).toBe(loyalty.REFERRAL_LIFETIME_CAP_POINTS);
    expect((await backend.getHistory(referrer)).reduce((n, h) => n + h.deltaPoints, 0)).toBe(500);
    // Replays and later purchases of an already capped friend never retry a grant.
    await backend.checkout(friends[13], checkout(friends[13]));
    expect(await paidTotal(referrer)).toBe(500);
  });

  it('RF-S4 spend, expiry, deletion/rejoin and backend restart cannot replenish the lifetime budget', async () => {
    const referrer = await member();
    const phone = (await backend.getMember(referrer)).phone;
    for (let i = 0; i < 10; i += 1) {
      const friend = await member();
      await attach(referrer, friend);
      await backend.checkout(friend, checkout(friend, 3, new Date()));
    }
    expect(await paidTotal(referrer)).toBe(500);
    await backend.spendPoints(referrer, 500, 'صرف', 'Spent');
    expect(liveBalance((await backend.getMember(referrer)).lots)).toBe(0);
    const d = await backend.requestDeletion(referrer, AT);
    await backend.eraseDueDeletions(new Date(d.eraseAfter));
    // Production preserves the account's phone and anti-abuse stamps.
    expect((await backend.findOrCreateByPhone(phone)).id).toBe(referrer);
    await backend.verifyMemberPhone(referrer, phone, new Date());
    if (db) backend = createPostgresBackend(db); // fresh service instance, same durable database
    expect((await backend.getMember(referrer)).phoneVerifiedAt).not.toBeNull();
    const friend = await member();
    await attach(referrer, friend);
    await backend.checkout(friend, checkout(friend, 3, new Date('2028-12-01T12:00:00Z')));
    expect(await paidTotal(referrer)).toBe(500);
    expect((await backend.getReferralOf(friend))?.rewardPoints).toBe(0);
    expect(liveBalance((await backend.getMember(referrer)).lots, new Date('2028-12-01T12:00:00Z'))).toBe(0);
  });

  it('RF-S5 proof is rechecked at settlement: a pending referral with a revoked proof is stamped 0', async () => {
    const referrer = await member();
    const friend = await member();
    await attach(referrer, friend);
    if (db) await db.query('update members set phone_verified_at = null where id = $1', [friend]);
    else (await backend.getMember(friend)).phoneVerifiedAt = null;
    await backend.checkout(friend, checkout(friend));
    expect(await paidTotal(referrer)).toBe(0);
    expect((await backend.getReferralOf(friend))?.rewardPoints).toBe(0);
    await backend.verifyMemberPhone(friend, (await backend.getMember(friend)).phone, AT);
    await backend.checkout(friend, checkout(friend));
    expect(await paidTotal(referrer)).toBe(0);
  });
});

it('RF-S6 phone-proof migration is rerunnable and never backfills ownership from a stored phone', async () => {
  const db = await pgTestDb();
  const backend = createPostgresBackend(db);
  const m = await backend.findOrCreateByPhone('+962791234567');
  await db.query(readMigration('20261016160147_referral_security.sql'));
  await db.query(readMigration('20261016160147_referral_security.sql'));
  expect((await backend.getMember(m.id)).phoneVerifiedAt).toBeNull();
  await backend.verifyMemberPhone(m.id, m.phone, AT);
  await db.query(readMigration('20261016160147_referral_security.sql'));
  expect((await createPostgresBackend(db).getMember(m.id)).phoneVerifiedAt).toBe(AT.toISOString());
});

it('RF-S7 PostgreSQL locks the inviter before reading the cap; a failed stamp rolls back the entire grant', async () => {
  const real = await pgTestDb();
  const statements: { sql: string; params: unknown[] }[] = [];
  let failStamp = false;
  const wrap = (inner: Db): Db => ({
    query<T>(sql: string, params: unknown[] = []) {
      const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
      statements.push({ sql: normalized, params });
      if (failStamp && normalized.startsWith('update referrals set rewarded_at')) {
        throw new Error('injected failure after the referrer grant');
      }
      return inner.query<T>(sql, params);
    },
    tx<T>(fn: (t: Db) => Promise<T>) { return inner.tx((t) => fn(wrap(t))); },
  });
  const backend = createPostgresBackend(wrap(real));
  const inviter = await backend.findOrCreateByPhone('+962791111111');
  const friend = await backend.findOrCreateByPhone('+962792222222');
  await backend.verifyMemberPhone(inviter.id, inviter.phone, AT);
  await backend.verifyMemberPhone(friend.id, friend.phone, AT);
  await backend.attachReferral(friend.id, (await backend.getReferral(inviter.id)).code, AT);
  statements.length = 0;
  failStamp = true;
  await expect(backend.checkout(friend.id, checkout(friend.id))).rejects.toThrow('injected failure');
  failStamp = false;
  const lockAt = statements.findIndex((s) => s.sql.endsWith('from members where id = $1 for no key update')
    && s.params[0] === inviter.id);
  const capAt = statements.findIndex((s) => s.sql.includes('sum(reward_points)') && s.params[0] === inviter.id);
  expect(lockAt).toBeGreaterThanOrEqual(0);
  expect(capAt).toBeGreaterThan(lockAt);
  expect((await backend.getReferral(inviter.id)).pointsEarned).toBe(0);
  expect(liveBalance((await backend.getMember(inviter.id)).lots, AT)).toBe(0);
  expect((await backend.getMember(friend.id)).firstPaidAt).toBeNull();
  expect((await backend.getReferralOf(friend.id))?.rewardedAt).toBeNull();
  expect(await real.query('select id from orders where member_id = $1', [friend.id])).toEqual([]);
  await backend.checkout(friend.id, checkout(friend.id));
  expect((await backend.getReferral(inviter.id)).pointsEarned).toBe(50);
});
