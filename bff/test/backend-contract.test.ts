// Runs the second-visit engine ON: it is off in the shipped config (see the module).
import './lib/second-visit-on';
import { describe, it, expect, beforeEach } from 'vitest';
import { liveBalance } from '@almond/shared/loyalty/lots';
import { config as loyalty } from '@almond/shared/config';
import { createMemoryBackend } from '../src/backend/memory';
import { createPostgresBackend } from '../src/backend/postgres';
import { assignHoldout, holdoutSpecFromConfig } from '@almond/shared/loyalty/holdout';
import type { Backend } from '../src/backend';
import type { CheckoutInput, TillEarnInput } from '../src/backend/types';
import { IDEMPOTENCY_TTL_MS } from '../src/backend/idempotency';
import { pgTestDb } from './lib/pgTestDb';

/**
 * T37 — ONE SPECIFICATION, TWO BACKENDS.
 *
 * 🔴 WHY THIS FILE EXISTS. There are now two implementations of `Backend`: the
 * in-memory one that `npm run dev` and every other suite run against, and the
 * Postgres one that survives a restart. This repository has been bitten by
 * exactly this shape more than once — an app that computed points beside the
 * server, a mock that invented a voucher rail the server did not have, an
 * `isDrink` flag that disagreed with the classifier. Two implementations of one
 * rule diverge; the only question is when.
 *
 * So the rules are asserted ONCE and executed against BOTH. A behaviour that
 * exists in one and not the other fails here, in the implementation that is
 * wrong, by name.
 *
 * The Postgres side runs on PGlite — Postgres compiled to WebAssembly, loading
 * the REAL migration file — so a missing column, a violated constraint or a bad
 * cast fails in CI rather than the first time a roster is uploaded.
 */

const BACKENDS: [string, () => Promise<Backend>][] = [
  ['memory', async () => createMemoryBackend()],
  ['postgres', async () => createPostgresBackend(await pgTestDb())],
];

describe.each(BACKENDS)('T37 backend contract — %s', (_name, make) => {
  let backend: Backend;
  beforeEach(async () => { backend = await make(); });

  const newMember = async (phone = '+962791234567') =>
    (await backend.findOrCreateByPhone(phone)).id;
  const points = async (id: string) => liveBalance((await backend.getMember(id)).lots);

  it('creates a member once, and finds the same one again', async () => {
    const a = await backend.findOrCreateByPhone('+962791234567', 'حمزة');
    const b = await backend.findOrCreateByPhone('+962791234567');
    expect(b.id).toBe(a.id);
    expect(b.name).toBe('حمزة');           // Arabic survives the round trip
    expect(a.heldTierId).toBe('base');
    expect(a.profileBonusAt).toBeNull();    // owed the bonus: they told us nothing
  });

  it('an unknown member is notFound, not an empty object', async () => {
    await expect(backend.getMember('nope')).rejects.toThrow();
  });

  it('grants points as lots and reads the balance back', async () => {
    const id = await newMember();
    expect(await backend.addPoints(id, 120, 'اختبار', 'Test')).toBe(120);
    expect(await points(id)).toBe(120);
    const h = await backend.getHistory(id);
    expect(h[0].deltaPoints).toBe(120);
    expect(h[0].reasonAr).toBe('اختبار');
  });

  it('🔴 spends oldest-lot-first and refuses a shortfall without moving anything', async () => {
    const id = await newMember();
    await backend.addPoints(id, 100, 'أ', 'A');
    await expect(backend.spendPoints(id, 101, 'ب', 'B')).rejects.toThrow();
    expect(await points(id)).toBe(100);      // nothing was taken on the way to refusing
    expect(await backend.spendPoints(id, 40, 'ب', 'B')).toBe(60);
  });

  it('pays the profile bonus exactly once, however many times the name is saved', async () => {
    const id = await newMember();
    const first = await backend.setProfile(id, { name: 'حمزة', birthday: null });
    expect(first.bonusGranted).toBe(loyalty.PROFILE_COMPLETION_BONUS);
    const again = await backend.setProfile(id, { name: 'حمزة العموش', birthday: null });
    expect(again.bonusGranted).toBe(0);      // re-saving succeeds and pays nothing
    expect(await points(id)).toBe(loyalty.PROFILE_COMPLETION_BONUS);
  });

  it('records spend into the rolling window and never demotes the held rung', async () => {
    const id = await newMember();
    await backend.recordSpend(id, 70);
    const s = await backend.getStanding(id);
    expect(s.windowSpend).toBe(70);
    // `held`, not `tier`: TierStanding names the three separately — the floor
    // that can only rise, what the window qualifies for now, and the max of the
    // two, which is what the member is actually paid.
    expect(s.held.id).not.toBe('base');
    // A day 200 days back is outside the window and must not raise anything.
    await backend.recordSpend(id, 500, '2020-01-01');
    expect((await backend.getStanding(id)).windowSpend).toBe(70);
  });

  it('the wallet is a second ledger, refusing overdraft', async () => {
    const id = await newMember();
    expect(await backend.creditWallet(id, 20_000, 'topup')).toBe(20_000);
    await expect(backend.debitWallet(id, 20_001)).rejects.toThrow();
    expect(await backend.debitWallet(id, 5_000)).toBe(15_000);
  });

  it('persists an order and its earn breakdown, refusing an unknown order', async () => {
    const id = await newMember();
    const o = await backend.createOrder({
      memberId: id, branchId: 'b1', type: 'pickup', paymentMethod: 'cash',
      subtotal: 5, tax: 0.8, total: 5.8, pointsEarned: 0,
    });
    await backend.recordEarnBreakdown(o.id, { points: 12 } as never);
    await expect(backend.recordEarnBreakdown('ord_nope', { points: 1 } as never)).rejects.toThrow();
  });

  // ---- redemptions: the money invariants ----

  it('🔴 redeeming spends the points and mints a code', async () => {
    const id = await newMember();
    await backend.addPoints(id, 500, 'أ', 'A');
    const r = await backend.createRedemption(id, 300);
    expect(r.points).toBe(300);
    expect(r.valueJod).toBe(3);
    expect(r.code).toHaveLength(8);
    expect(await points(id)).toBe(200);
    expect((await backend.activeRedemption(id))?.id).toBe(r.id);
    expect((await backend.findRedemptionByCode(r.code))?.id).toBe(r.id);
  });

  it('🔴 settles exactly once — a replay is refused', async () => {
    const id = await newMember();
    await backend.addPoints(id, 500, 'أ', 'A');
    const r = await backend.createRedemption(id, 100);
    const at = new Date();
    expect((await backend.settleRedemption(r.id, 'pos', at)).settledVia).toBe('pos');
    await expect(backend.settleRedemption(r.id, 'pos', at)).rejects.toThrow();
    expect(await backend.activeRedemption(id)).toBeNull();
  });

  it('🔴 an expired code returns its points IN FULL, and a settled one never does', async () => {
    const id = await newMember();
    await backend.addPoints(id, 500, 'أ', 'A');

    const dead = await backend.createRedemption(id, 200);
    const past = new Date(Date.parse(dead.expiresAt) + 1000);
    expect(await backend.sweepRedemptions(id, past)).toBe(1);
    expect(await points(id)).toBe(500);                       // whole, not part
    await expect(backend.settleRedemption(dead.id, 'pos', past)).rejects.toThrow();

    const used = await backend.createRedemption(id, 150);
    await backend.settleRedemption(used.id, 'web', new Date());
    const after = await points(id);
    expect(await backend.sweepRedemptions(id, new Date(Date.parse(used.expiresAt) + 1000))).toBe(0);
    expect(await points(id)).toBe(after);                     // never paid twice
  });

  it('cancelling returns the points immediately and is idempotent', async () => {
    const id = await newMember();
    await backend.addPoints(id, 500, 'أ', 'A');
    const r = await backend.createRedemption(id, 120);
    const at = new Date();
    await backend.cancelRedemption(id, r.id, at);
    expect(await points(id)).toBe(500);
    await backend.cancelRedemption(id, r.id, at);
    expect(await points(id)).toBe(500);                       // not 620
  });

  // ---- the corporate register ----

  it('stores companies and resolves an entitlement from the member phone', async () => {
    await backend.saveCompany({
      id: 'almond', nameAr: 'موظفو ألموند', nameEn: 'Almond staff', percentOff: 50, active: true,
    });
    const id = await newMember('+962791234567');
    expect(await backend.entitlementFor(id)).toBeNull();       // not on any roster yet

    expect(await backend.replaceRoster('almond', [
      { phone: '0791234567', companyId: 'almond', name: 'حمزة' },
      { phone: '0799876543', companyId: 'almond' },
    ])).toBe(2);
    expect((await backend.entitlementFor(id))?.percentOff).toBe(50);
    expect((await backend.listRoster('almond')).find((e) => e.phone === '+962791234567')?.name)
      .toBe('حمزة');
  });

  it('🔴 uploading REPLACES the roster — a leaver loses the discount at once', async () => {
    await backend.saveCompany({
      id: 'almond', nameAr: '', nameEn: 'Almond', percentOff: 50, active: true,
    });
    const id = await newMember('+962791234567');
    await backend.replaceRoster('almond', [{ phone: '0791234567', companyId: 'almond' }]);
    expect(await backend.entitlementFor(id)).not.toBeNull();

    await backend.replaceRoster('almond', [{ phone: '0799876543', companyId: 'almond' }]);
    expect(await backend.entitlementFor(id)).toBeNull();
    expect(await backend.listRoster('almond')).toHaveLength(1);
  });

  it('switching a company off withdraws it from everyone on its roster', async () => {
    await backend.saveCompany({ id: 'c', nameAr: '', nameEn: 'C', percentOff: 20, active: true });
    const id = await newMember('+962791234567');
    await backend.replaceRoster('c', [{ phone: '0791234567', companyId: 'c' }]);
    expect(await backend.entitlementFor(id)).not.toBeNull();
    await backend.saveCompany({ id: 'c', nameAr: '', nameEn: 'C', percentOff: 20, active: false });
    expect(await backend.entitlementFor(id)).toBeNull();
  });

  it('logs a use with the rate that APPLIED, and filters it back', async () => {
    await backend.saveCompany({ id: 'c', nameAr: '', nameEn: 'C', percentOff: 20, active: true });
    const id = await newMember();
    await backend.recordCorporateUse({
      memberId: id, companyId: 'c', phone: '+962791234567', at: new Date().toISOString(),
      orderId: null, items: [{ nameAr: 'لاتيه', nameEn: 'Latte', qty: 2 }],
      percentOff: 20, discountJod: 1.5,
    });
    const uses = await backend.listCorporateUses({ companyId: 'c' });
    expect(uses).toHaveLength(1);
    expect(uses[0].percentOff).toBe(20);
    expect(uses[0].discountJod).toBe(1.5);
    expect(uses[0].items[0].nameAr).toBe('لاتيه');
    expect(await backend.listCorporateUses({ companyId: 'other' })).toHaveLength(0);
  });

  it('the subscription refuses a drink when nobody is subscribed', async () => {
    const id = await newMember();
    await expect(backend.redeemSubscriptionDrink(id)).rejects.toThrow();
    expect((await backend.getSubscription(id)).active).toBe(false);
  });

  // ---- checkout: ONE transaction (was a three-transaction saga) ----

  const wallet = async (id: string) => liveBalance((await backend.getMember(id)).walletLots);
  const checkoutInput = (id: string, over: Partial<CheckoutInput> = {}): CheckoutInput => ({
    order: { branchId: 'b1', type: 'pickup', paymentMethod: 'wallet', subtotal: 5.37, tax: 0.43, total: 5.8 },
    walletDebitFils: 5_800, pointsEarned: 29,
    pointsReasonAr: 'نقاط طلب', pointsReasonEn: 'Order points',
    earn: { points: 29 } as never, spendJod: 5.8, corporateUse: null,
    // No drink, so a member with no prior order is DECLINED — deterministic,
    // whatever holdout arm the id falls in. An order that leaked from a failed
    // checkout would make the next one INELIGIBLE instead.
    secondVisit: { basketHasDrink: false, arm: assignHoldout(id, holdoutSpecFromConfig('secondVisitVoucher')) },
    at: new Date(),
    ...over,
  });

  it('🔴 checkout debits, writes the order, grants and records the spend — in one call', async () => {
    const id = await newMember();
    await backend.creditWallet(id, 10_000, 'topup');
    const r = await backend.checkout(id, checkoutInput(id));
    expect(r.walletBalanceFils).toBe(4_200);
    expect(r.pointsBalance).toBe(29);
    expect(r.order.pointsEarned).toBe(29);
    expect(r.order.earn).toEqual({ points: 29 });
    expect(r.order.memberId).toBe(id);
    expect(r.secondVisitError).toBeNull();
    expect(await wallet(id)).toBe(4_200);
    expect(await points(id)).toBe(29);
    expect((await backend.getHistory(id))[0]).toMatchObject({ deltaPoints: 29, reasonEn: 'Order points' });
    expect((await backend.getStanding(id)).windowSpend).toBe(5.8);
    expect((await backend.getSecondVisitVoucher(id))?.outcome).toBe('declined');
  });

  it('🔴 checkout refuses a short wallet having written NOTHING', async () => {
    const id = await newMember();
    await backend.creditWallet(id, 1_000, 'topup');
    const historyBefore = await backend.getHistory(id);
    await expect(backend.checkout(id, checkoutInput(id))).rejects.toMatchObject({ code: 'insufficient_wallet' });
    expect(await wallet(id)).toBe(1_000);
    expect(await points(id)).toBe(0);
    expect(await backend.getHistory(id)).toEqual(historyBefore);
    expect(await backend.getSecondVisitVoucher(id)).toBeNull();
    expect((await backend.getStanding(id)).windowSpend).toBe(0);
  });

  it('🔴 a failure AFTER the debit and the order rolls ALL of it back — no debit, no order, no use, no voucher', async () => {
    await backend.saveCompany({ id: 'acme', nameAr: '', nameEn: 'Acme', percentOff: 20, active: true });
    const id = await newMember();
    await backend.creditWallet(id, 10_000, 'topup');
    const historyBefore = await backend.getHistory(id);
    // A negative grant is refused at the GRANT step — after the wallet was
    // debited, the order written, the voucher evaluated and the corporate use
    // logged. Every one of those must be undone.
    const failing = checkoutInput(id, {
      pointsEarned: -1,
      corporateUse: { companyId: 'acme', items: [{ nameAr: 'لاتيه', nameEn: 'Latte', qty: 1 }], percentOff: 20, discountJod: 1.16 },
    });
    await expect(backend.checkout(id, failing)).rejects.toMatchObject({ code: 'negative_grant' });
    expect(await wallet(id)).toBe(10_000);
    expect(await backend.getHistory(id)).toEqual(historyBefore);
    expect(await backend.listCorporateUses({ memberId: id })).toEqual([]);
    expect(await backend.getSecondVisitVoucher(id)).toBeNull();
    expect((await backend.getStanding(id)).windowSpend).toBe(0);
    // …and no ORDER survived either: the next checkout is still this member's
    // first transaction, so its voucher row is 'declined', not 'ineligible'.
    await backend.checkout(id, checkoutInput(id));
    expect((await backend.getSecondVisitVoucher(id))?.outcome).toBe('declined');
    expect(await wallet(id)).toBe(4_200);
  });

  it('checkout records the corporate use with the member phone and the new order id', async () => {
    await backend.saveCompany({ id: 'acme', nameAr: '', nameEn: 'Acme', percentOff: 50, active: true });
    const id = await newMember('+962791234567');
    await backend.creditWallet(id, 10_000, 'topup');
    const r = await backend.checkout(id, checkoutInput(id, {
      pointsEarned: 0, earn: null,
      corporateUse: { companyId: 'acme', items: [{ nameAr: 'لاتيه', nameEn: 'Latte', qty: 2 }], percentOff: 50, discountJod: 2.9 },
    }));
    const uses = await backend.listCorporateUses({ memberId: id });
    expect(uses).toHaveLength(1);
    expect(uses[0]).toMatchObject({ companyId: 'acme', phone: '+962791234567', orderId: r.order.id, percentOff: 50, discountJod: 2.9 });
    expect(uses[0].items[0].nameAr).toBe('لاتيه');
  });

  it('an unfunded checkout writes the order, logs a 0 grant and touches neither wallet nor window', async () => {
    const id = await newMember();
    const r = await backend.checkout(id, checkoutInput(id, {
      order: { branchId: 'b1', type: 'pickup', paymentMethod: 'cash', subtotal: 5.37, tax: 0.43, total: 5.8 },
      walletDebitFils: 0, pointsEarned: 0, earn: null, spendJod: null,
    }));
    expect(r.order.pointsEarned).toBe(0);
    expect(r.order.earn).toBeUndefined();
    expect((await backend.getHistory(id))[0]).toMatchObject({ deltaPoints: 0, reasonEn: 'Order points' });
    expect((await backend.getStanding(id)).windowSpend).toBe(0);
  });

  it('🔴 a subscription is bought in one step: debited and active together, or neither', async () => {
    const id = await newMember();
    await backend.creditWallet(id, 5_000, 'topup');
    await expect(backend.purchaseSubscription(id, 18_000)).rejects.toMatchObject({ code: 'insufficient_wallet' });
    expect(await wallet(id)).toBe(5_000);
    expect((await backend.getSubscription(id)).active).toBe(false);
    await backend.creditWallet(id, 15_000, 'topup');
    const r = await backend.purchaseSubscription(id, 18_000);
    expect(r.subscription.active).toBe(true);
    expect(r.walletBalanceFils).toBe(2_000);
    expect(await wallet(id)).toBe(2_000);
  });

  it('a top-up and its reload bonus land together; a zero bonus writes no points line', async () => {
    const id = await newMember();
    expect(await backend.topUpWallet(id, 20_000, 50, 'مكافأة', 'Bonus')).toEqual({ walletBalanceFils: 20_000, pointsBalance: 50 });
    expect((await backend.getHistory(id))[0]).toMatchObject({ deltaPoints: 50, reasonEn: 'Bonus' });
    await backend.topUpWallet(id, 1_000, 0, 'مكافأة', 'Bonus');
    expect(await backend.getHistory(id)).toHaveLength(1);
    await expect(backend.topUpWallet(id, 1_000, -5, 'x', 'x')).rejects.toMatchObject({ code: 'negative_grant' });
    expect(await wallet(id)).toBe(21_000);
  });

  // ---- the Idempotency-Key store ----

  it('🔴 an Idempotency-Key is claimed once, replays once done, and is bound to one request', async () => {
    const t0 = new Date('2026-09-23T10:00:00Z');
    expect(await backend.claimIdempotencyKey('m1', 'K', 'h1', t0)).toEqual({ state: 'claimed' });
    expect(await backend.claimIdempotencyKey('m1', 'K', 'h1', t0)).toEqual({ state: 'pending' });
    expect(await backend.claimIdempotencyKey('m1', 'K', 'h2', t0)).toEqual({ state: 'mismatch' });
    // Scoped to the member: another member's identical key is theirs alone.
    expect(await backend.claimIdempotencyKey('m2', 'K', 'h1', t0)).toEqual({ state: 'claimed' });

    await backend.completeIdempotencyKey('m1', 'K', 'h2', 201, '{"wrong":true}');   // not the holder: ignored
    expect(await backend.claimIdempotencyKey('m1', 'K', 'h1', t0)).toEqual({ state: 'pending' });
    await backend.completeIdempotencyKey('m1', 'K', 'h1', 201, '{"b":1,"a":"٣"}');
    const done = { state: 'done', statusCode: 201, body: '{"b":1,"a":"٣"}' };   // the exact bytes
    expect(await backend.claimIdempotencyKey('m1', 'K', 'h1', t0)).toEqual(done);
    expect(await backend.claimIdempotencyKey('m1', 'K', 'h2', t0)).toEqual({ state: 'mismatch' });
    // A finished key is never released — a replay must not become a re-run.
    await backend.releaseIdempotencyKey('m1', 'K', 'h1');
    expect(await backend.claimIdempotencyKey('m1', 'K', 'h1', t0)).toEqual(done);
  });

  it('a released key may be retried; an expired one (24 h) protects nothing', async () => {
    const t0 = new Date('2026-09-23T10:00:00Z');
    await backend.claimIdempotencyKey('m1', 'R', 'h', t0);
    await backend.releaseIdempotencyKey('m1', 'R', 'h');
    expect(await backend.claimIdempotencyKey('m1', 'R', 'h', t0)).toEqual({ state: 'claimed' });

    await backend.completeIdempotencyKey('m1', 'R', 'h', 200, '{}');
    const edge = new Date(t0.getTime() + IDEMPOTENCY_TTL_MS);
    expect((await backend.claimIdempotencyKey('m1', 'R', 'h', edge)).state).toBe('done');
    const after = new Date(t0.getTime() + IDEMPOTENCY_TTL_MS + 1);
    // Expired: a NEW request — with any body — claims it afresh.
    expect(await backend.claimIdempotencyKey('m1', 'R', 'other', after)).toEqual({ state: 'claimed' });
    expect(await backend.claimIdempotencyKey('m1', 'R', 'other', after)).toEqual({ state: 'pending' });
  });

  it('parallel claims of one key: exactly one wins', async () => {
    const at = new Date();
    const rs = await Promise.all(Array.from({ length: 8 }, () => backend.claimIdempotencyKey('m1', 'P', 'h', at)));
    expect(rs.filter((r) => r.state === 'claimed')).toHaveLength(1);
    expect(rs.filter((r) => r.state === 'pending')).toHaveLength(7);
  });
  // ---- the till's earn (POST /v1/pos/earn → Backend.tillEarn) ----

  let saleSeq = 0;
  const sale = (memberId: string, over: Partial<TillEarnInput> = {}): TillEarnInput => {
    saleSeq += 1;
    return {
      posOrderRef: `Shop/${saleSeq}`, memberId, ticketJti: `jti-${saleSeq}`, ticketRefusal: null,
      branchId: 'b1', paidFils: 12_500, paidAt: new Date(), pointsEarned: 25,
      earn: { points: 25 } as never, spendJod: 12.5, spendDay: null,
      reasonAr: 'نقاط مشتريات الفرع', reasonEn: 'In-store purchase points', at: new Date(),
      ...over,
    };
  };

  it('🔴 a till sale grants its points, logs them and counts toward the window — in one call', async () => {
    const id = await newMember();
    const input = sale(id);
    const r = await backend.tillEarn(input);
    expect(r.replay).toBe(false);
    expect(r.sale).toMatchObject({
      posOrderRef: input.posOrderRef, memberId: id, branchId: 'b1', paidFils: 12_500,
      pointsEarned: 25, pointsBalanceAfter: 25, status: 'earned', reversedPoints: null,
    });
    expect(await points(id)).toBe(25);
    expect((await backend.getHistory(id))[0]).toMatchObject({ deltaPoints: 25, reasonEn: 'In-store purchase points' });
    expect((await backend.getStanding(id)).windowSpend).toBe(12.5);
    expect((await backend.getTillSale(input.posOrderRef))?.pointsEarned).toBe(25);
    expect(await backend.getTillSale('Shop/never')).toBeNull();
  });

  it('🔴 the same POS order again is a REPLAY: the stored answer, and nothing granted twice', async () => {
    const id = await newMember();
    const input = sale(id);
    const first = await backend.tillEarn(input);
    // A retry — even with a different, fresh ticket id and an expired one.
    const again = await backend.tillEarn({ ...input, ticketJti: 'another', ticketRefusal: 'expired' as const, pointsEarned: 99 });
    expect(again.replay).toBe(true);
    expect(again.sale).toEqual(first.sale);
    expect(await points(id)).toBe(25);
    expect((await backend.getHistory(id)).filter((h) => h.reasonEn === 'In-store purchase points')).toHaveLength(1);
    expect((await backend.getStanding(id)).windowSpend).toBe(12.5);
  });

  it('🔴 the same POS order with a different member, amount or branch is a conflict — nothing moves', async () => {
    const a = await newMember('+962791111111');
    const b = await newMember('+962792222222');
    const input = sale(a);
    await backend.tillEarn(input);
    for (const over of [{ memberId: b }, { paidFils: 125_000 }, { branchId: 'b2' }]) {
      await expect(backend.tillEarn({ ...input, ticketJti: `x-${JSON.stringify(over)}`, ...over }), JSON.stringify(over))
        .rejects.toMatchObject({ code: 'pos_order_conflict' });
    }
    expect(await points(a)).toBe(25);
    expect(await points(b)).toBe(0);
    expect(await backend.getHistory(b)).toEqual([]);
  });

  it('🔴 one earn ticket pays for ONE sale: a second POS order on it is refused, writing nothing', async () => {
    const id = await newMember();
    await backend.tillEarn(sale(id, { ticketJti: 'T' }));
    const historyBefore = await backend.getHistory(id);
    await expect(backend.tillEarn(sale(id, { ticketJti: 'T' }))).rejects.toMatchObject({ code: 'ticket_used' });
    expect(await points(id)).toBe(25);
    expect(await backend.getHistory(id)).toEqual(historyBefore);
  });

  it('an expired ticket cannot start a sale; a negative grant is refused; neither writes anything', async () => {
    const id = await newMember();
    const expired = sale(id, { ticketRefusal: 'expired' as const });
    await expect(backend.tillEarn(expired)).rejects.toMatchObject({ code: 'ticket_expired' });
    expect(await backend.getTillSale(expired.posOrderRef)).toBeNull();
    const negative = sale(id, { pointsEarned: -1 });
    await expect(backend.tillEarn(negative)).rejects.toMatchObject({ code: 'negative_grant' });
    expect(await backend.getTillSale(negative.posOrderRef)).toBeNull();
    expect(await points(id)).toBe(0);
    expect(await backend.getHistory(id)).toEqual([]);
    expect((await backend.getStanding(id)).windowSpend).toBe(0);
  });

  it('a sale paid entirely with points (0 JOD) records a 0 grant and no window spend', async () => {
    const id = await newMember();
    const r = await backend.tillEarn(sale(id, { paidFils: 0, pointsEarned: 0, earn: null, spendJod: null }));
    expect(r.sale.spendDay).toBeNull();
    expect((await backend.getHistory(id))[0]).toMatchObject({ deltaPoints: 0 });
    expect((await backend.getStanding(id)).windowSpend).toBe(0);
  });

  it('🔴 reversing a sale takes its points back once, and its spend out of the window', async () => {
    const id = await newMember();
    await backend.addPoints(id, 100, 'منحة', 'Grant');
    const input = sale(id, { spendDay: null });
    await backend.tillEarn(input);
    expect((await backend.getStanding(id)).windowSpend).toBe(12.5);
    const at = new Date();
    const r = await backend.reverseTillEarn(input.posOrderRef, 'refund', at);
    expect(r.replay).toBe(false);
    expect(r.sale).toMatchObject({ status: 'reversed', reversedPoints: 25, shortfall: 0, reverseBalanceAfter: 100, reverseReason: 'refund' });
    expect(await points(id)).toBe(100);
    expect((await backend.getStanding(id)).windowSpend).toBe(0);
    expect((await backend.getHistory(id))[0]).toMatchObject({ deltaPoints: -25, reasonEn: 'Refunded purchase points' });
    // Again: the stored reversal, nothing more taken.
    const again = await backend.reverseTillEarn(input.posOrderRef, 'refund', at);
    expect(again.replay).toBe(true);
    expect(again.sale).toEqual(r.sale);
    expect(await points(id)).toBe(100);
    // The ledger still reconciles with the lots.
    expect((await backend.getHistory(id)).reduce((n, h) => n + h.deltaPoints, 0)).toBe(100);
  });

  it('🔴 a reversal never drives the balance negative: what was already spent is the shortfall', async () => {
    const id = await newMember();
    const input = sale(id);
    await backend.tillEarn(input);                          // 25 points
    await backend.spendPoints(id, 20, 'صرف', 'Spend');      // 5 left
    const r = await backend.reverseTillEarn(input.posOrderRef, 'void', new Date());
    expect(r.sale).toMatchObject({ reversedPoints: 5, shortfall: 20, reverseBalanceAfter: 0 });
    expect(await points(id)).toBe(0);
    // Spent to the last point: nothing to take, all shortfall, still no negative.
    const id2 = await newMember('+962793333333');
    const s2 = sale(id2);
    await backend.tillEarn(s2);
    await backend.spendPoints(id2, 25, 'صرف', 'Spend');
    const r2 = await backend.reverseTillEarn(s2.posOrderRef, 'void', new Date());
    expect(r2.sale).toMatchObject({ reversedPoints: 0, shortfall: 25, reverseBalanceAfter: 0 });
    expect(await points(id2)).toBe(0);
    await expect(backend.reverseTillEarn('Shop/unknown', 'x', new Date())).rejects.toMatchObject({ code: 'not_found' });
  });

  // ---- card payment intents, and the checkout that spends one ----

  const intent = (memberId: string, over: Record<string, unknown> = {}) => ({
    id: `pi_${Math.random().toString(36).slice(2)}`, memberId, amountFils: 5_800, currency: 'JOD' as const,
    cartHash: 'cart-A', provider: 'mock', providerRef: `ref_${Math.random().toString(36).slice(2)}`, ...over,
  });
  const cardCheckout = (id: string, intentId: string, over: Partial<CheckoutInput> = {}) => checkoutInput(id, {
    order: { branchId: 'b1', type: 'pickup', paymentMethod: 'visa', subtotal: 5.37, tax: 0.43, total: 5.8 },
    walletDebitFils: 0, payment: { intentId, amountFils: 5_800, cartHash: 'cart-A', captureRef: 'cap-1' },
    ...over,
  });

  it('stores an intent and moves it only forward on a webhook', async () => {
    const id = await newMember();
    const created = await backend.createPaymentIntent(intent(id), new Date());
    expect(created).toMatchObject({ status: 'pending', orderId: null, captureRef: null, amountFils: 5_800 });
    expect(await backend.getPaymentIntent(created.id)).toEqual(created);
    expect(await backend.getPaymentIntent('pi_none')).toBeNull();
    expect(await backend.recordPaymentStatus('mock', 'ref_none', 'captured', new Date())).toBeNull();
    // Another provider's reference is not this one's.
    expect(await backend.recordPaymentStatus('other', created.providerRef, 'captured', new Date())).toBeNull();
    expect((await backend.recordPaymentStatus('mock', created.providerRef, 'failed', new Date()))?.status).toBe('failed');
    // A declined card may be retried and captured…
    expect((await backend.recordPaymentStatus('mock', created.providerRef, 'captured', new Date()))?.status).toBe('captured');
    // …but a capture is never undone by a later event.
    expect((await backend.recordPaymentStatus('mock', created.providerRef, 'failed', new Date()))?.status).toBe('captured');
  });

  it('🔴 a card checkout spends its captured intent INSIDE the transaction — once', async () => {
    const id = await newMember();
    const pi = await backend.createPaymentIntent(intent(id), new Date());
    const r = await backend.checkout(id, cardCheckout(id, pi.id));
    expect(r.order.paymentMethod).toBe('visa');
    expect(await points(id)).toBe(29);
    const spent = await backend.getPaymentIntent(pi.id);
    expect(spent).toMatchObject({ status: 'captured', orderId: r.order.id, captureRef: 'cap-1' });
    // One payment, one order.
    const historyBefore = await backend.getHistory(id);
    await expect(backend.checkout(id, cardCheckout(id, pi.id))).rejects.toMatchObject({ code: 'payment_intent_used' });
    expect(await points(id)).toBe(29);
    expect(await backend.getHistory(id)).toEqual(historyBefore);
  });

  it('🔴 an intent that is not this member\'s, not this amount, not this basket or declined funds nothing', async () => {
    const id = await newMember('+962791111111');
    const other = await newMember('+962792222222');
    const theirs = await backend.createPaymentIntent(intent(other), new Date());
    const wrongAmount = await backend.createPaymentIntent(intent(id, { amountFils: 5_799 }), new Date());
    const wrongCart = await backend.createPaymentIntent(intent(id, { cartHash: 'cart-B' }), new Date());
    const declined = await backend.createPaymentIntent(intent(id), new Date());
    await backend.recordPaymentStatus('mock', declined.providerRef, 'failed', new Date());
    for (const pi of [theirs, wrongAmount, wrongCart, declined]) {
      await expect(backend.checkout(id, cardCheckout(id, pi.id)), pi.id).rejects.toMatchObject({ statusCode: 402, code: 'payment_not_captured' });
      expect((await backend.getPaymentIntent(pi.id))?.orderId, pi.id).toBeNull();
    }
    await expect(backend.checkout(id, cardCheckout(id, 'pi_none'))).rejects.toMatchObject({ code: 'payment_not_captured' });
    expect(await points(id)).toBe(0);
    expect(await backend.getHistory(id)).toEqual([]);
  });

  it('🔴 a card checkout that fails after the order was written leaves the payment UNSPENT', async () => {
    const id = await newMember();
    const pi = await backend.createPaymentIntent(intent(id), new Date());
    await expect(backend.checkout(id, cardCheckout(id, pi.id, { pointsEarned: -1 }))).rejects.toMatchObject({ code: 'negative_grant' });
    expect(await backend.getPaymentIntent(pi.id)).toMatchObject({ status: 'pending', orderId: null });
    // …so the member can still place the order it paid for.
    const r = await backend.checkout(id, cardCheckout(id, pi.id));
    expect((await backend.getPaymentIntent(pi.id))?.orderId).toBe(r.order.id);
  });
});
