import { describe, expect, it } from 'vitest';
import { creditPointSlices, expiredUnusedPurchaseLotPoints, expiredUnusedPurchasePoints, recoverPurchasePoints, type UnusedRedemptionEvidence } from '@almond/shared/loyalty/clawback';
import { consumeFifo, grantLot, liveBalance, restoreSlices, spentSlices, type SpentSlice } from '@almond/shared/loyalty/lots';

const AT = new Date('2026-10-16T12:00:00.000Z');
const slice = (points: number, originRef = 'pos:SALE/1', overrides: Partial<SpentSlice> = {}): SpentSlice => ({
  points, source: 'earn', grantedOn: '2026-01-01', expiresOn: '2027-01-01', originRef, ...overrides,
});
const evidence = (overrides: Partial<UnusedRedemptionEvidence> = {}): UnusedRedemptionEvidence => ({
  id: 'r1', points: 20, slices: [slice(20, 'pos:SALE/1', { expiresOn: '2026-10-15' })],
  settledAt: null, cancelledAt: AT.toISOString(), returnedPoints: 0, expiredPoints: 20,
  recoveredPoints: 0, refundReviewRequired: false, ...overrides,
});

describe('C1 purchase point shortfall recovery', () => {
  it('recovers from incoming points only, with a bounded nonnegative result', () => {
    expect(recoverPurchasePoints(7, 5)).toEqual({ creditedPoints: 0, recoveredPoints: 5, debtAfter: 2 });
    expect(recoverPurchasePoints(5, 7)).toEqual({ creditedPoints: 2, recoveredPoints: 5, debtAfter: 0 });
    expect(recoverPurchasePoints(0, 7)).toEqual({ creditedPoints: 7, recoveredPoints: 0, debtAfter: 0 });
    expect(recoverPurchasePoints(7, 0)).toEqual({ creditedPoints: 0, recoveredPoints: 0, debtAfter: 7 });
    expect(recoverPurchasePoints(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER))
      .toEqual({ creditedPoints: 0, recoveredPoints: Number.MAX_SAFE_INTEGER, debtAfter: 0 });
  });
  it('rejects malformed debt or incoming money-shaped arithmetic instead of inventing a negative balance', () => {
    for (const bad of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => recoverPurchasePoints(bad, 5)).toThrow();
      expect(() => recoverPurchasePoints(5, bad)).toThrow();
    }
  });
});

describe('C2 point provenance through FIFO reservations and returns', () => {
  it('preserves exact provenance through grant, partial spend, slices, restore and another spend', () => {
    const first = grantLot([], 50, 'earn', AT, undefined, '2026-01-01', 'pos:SALE/1');
    const second = grantLot(first.lots, 30, 'bonus', AT, undefined, '2026-02-01', 'referral:friend1');
    const before = structuredClone(second.lots);
    const spend = consumeFifo(second.lots, 60, AT);
    expect(spend.ok).toBe(true);
    if (!spend.ok) throw new Error('expected affordable spend');
    const slices = spentSlices(second.lots, spend.consumed);
    expect(slices.map((s) => [s.points, s.originRef])).toEqual([[50, 'pos:SALE/1'], [10, 'referral:friend1']]);
    const back = restoreSlices(spend.lots, slices, AT);
    expect(back.restored).toBe(60);
    expect(back.lots.slice(-2).map((l) => [l.grantedOn, l.expiresOn, l.originRef]))
      .toEqual([['2026-01-01', '2027-01-01', 'pos:SALE/1'], ['2026-02-01', '2027-02-01', 'referral:friend1']]);
    const again = consumeFifo(back.lots, 60, AT);
    if (!again.ok) throw new Error('expected affordable second spend');
    expect(spentSlices(back.lots, again.consumed).filter((s) => s.originRef === 'pos:SALE/1')
      .reduce((n, s) => n + s.points, 0)).toBe(50);
    expect(second.lots).toEqual(before);
  });
  it('omits absent provenance on legacy shapes, and refuses invalid explicitly supplied references', () => {
    const legacy = grantLot([], 10, 'earn', AT);
    expect(legacy.lot).not.toHaveProperty('originRef');
    const spend = consumeFifo(legacy.lots, 10, AT);
    if (!spend.ok) throw new Error('expected affordable spend');
    const slices = spentSlices(legacy.lots, spend.consumed);
    expect(slices[0]).not.toHaveProperty('originRef');
    expect(restoreSlices(spend.lots, slices, AT).lots.at(-1)).not.toHaveProperty('originRef');
    expect(() => grantLot([], 10, 'earn', AT, undefined, undefined, '')).toThrow('originRef');
    expect(() => restoreSlices([], [slice(10, '')], AT)).toThrow('originRef');
  });
});

describe('C3 recovered incoming slice credit', () => {
  it('never consumes existing lots, recovers only live incoming points and preserves surviving lineage/dates', () => {
    const existing = grantLot([], 80, 'bonus', AT).lots;
    const original = structuredClone(existing);
    const incoming = [
      slice(15, 'pos:expired', { expiresOn: '2026-10-15' }),
      slice(20, 'pos:older', { grantedOn: '2026-02-01', expiresOn: '2027-02-01' }),
      slice(30, 'pos:newer', { grantedOn: '2026-03-01', expiresOn: '2027-03-01' }),
    ];
    const frozen = structuredClone(incoming);
    const result = creditPointSlices(existing, incoming, 25, AT);
    expect(result).toMatchObject({ returnedPoints: 25, expiredPoints: 15, recoveredPoints: 25, debtAfter: 0 });
    expect(result.lots.slice(0, existing.length)).toEqual(original);
    expect(result.lots.at(-1)).toMatchObject({
      amount: 25, remaining: 25, source: 'earn', originRef: 'pos:newer',
      grantedOn: '2026-03-01', expiresOn: '2027-03-01',
    });
    expect(liveBalance(result.lots, AT)).toBe(105);
    expect(existing).toEqual(original);
    expect(incoming).toEqual(frozen);
  });
  it('expired incoming points never repay debt; the expiry day itself remains usable', () => {
    const expired = creditPointSlices([], [slice(10, 'pos:x', { expiresOn: '2026-10-15' })], 10, AT);
    expect(expired).toEqual({ lots: [], returnedPoints: 0, expiredPoints: 10, recoveredPoints: 0, debtAfter: 10 });
    const today = creditPointSlices([], [slice(10, 'pos:x', { expiresOn: '2026-10-16' })], 4, AT);
    expect(today).toMatchObject({ returnedPoints: 6, expiredPoints: 0, recoveredPoints: 4, debtAfter: 0 });
    expect(today.lots[0]).toMatchObject({ expiresOn: '2026-10-16', originRef: 'pos:x' });
  });
  it('supports empty/all-recovered pools and does not assume a date sequence supplied by the caller', () => {
    expect(creditPointSlices([], [], 5, AT)).toEqual({ lots: [], returnedPoints: 0, expiredPoints: 0, recoveredPoints: 0, debtAfter: 5 });
    const result = creditPointSlices([], [slice(5, 'new', { grantedOn: '2026-03-01' }), slice(5, 'old')], 7, AT);
    expect(result).toMatchObject({ returnedPoints: 3, recoveredPoints: 7, debtAfter: 0 });
    expect(result.lots[0].originRef).toBe('new');
  });
  it('rejects invalid or money ledger slices atomically', () => {
    const existing = grantLot([], 10, 'bonus', AT).lots;
    const before = structuredClone(existing);
    const bad: SpentSlice[] = [
      slice(0), slice(-1), slice(0.5), slice(1, 'x', { grantedOn: '2026-02-30' }),
      slice(1, 'x', { expiresOn: '2025-01-01' }), slice(1, 'x', { source: 'topup' }),
      slice(1, 'x', { source: 'gift' }), slice(1, 'x', { source: 'refund' }), slice(1, ''),
    ];
    for (const invalid of bad) expect(() => creditPointSlices(existing, [slice(2), invalid], 1, AT)).toThrow();
    expect(() => creditPointSlices(existing, [slice(Number.MAX_SAFE_INTEGER), slice(1)], 1, AT)).toThrow();
    expect(() => creditPointSlices(existing, [], -1, AT)).toThrow();
    expect(existing).toEqual(before);
  });
});

describe('C4 proof of unused purchase expiry', () => {
  it('counts only expired original slices for the exact purchase; settled or pending redemptions give no exemption', () => {
    const rows = [evidence(), evidence({ id: 'other', slices: [slice(20, 'pos:OTHER', { expiresOn: '2026-10-15' })] }),
      evidence({ id: 'settled', settledAt: AT.toISOString() }), evidence({ id: 'pending', cancelledAt: null })];
    expect(expiredUnusedPurchasePoints(rows, 'pos:SALE/1')).toEqual({ points: 20, reviewRequired: false });
  });
  it('validates recorded expiry against cancellation time, including Amman midnight and original live returns', () => {
    const row = evidence({
      points: 50,
      slices: [slice(20, 'pos:SALE/1', { expiresOn: '2026-10-16' }), slice(30, 'pos:OTHER')],
      cancelledAt: '2026-10-16T21:00:00.000Z', // 17 Oct Amman: first slice has expired
      expiredPoints: 20, returnedPoints: 25, recoveredPoints: 5,
    });
    expect(expiredUnusedPurchasePoints([row], 'pos:SALE/1')).toEqual({ points: 20, reviewRequired: false });
    expect(expiredUnusedPurchasePoints([{ ...row, cancelledAt: '2026-10-16T20:59:59.999Z' }], 'pos:SALE/1'))
      .toEqual({ points: 0, reviewRequired: true });
    expect(expiredUnusedPurchasePoints([evidence({ expiredPoints: 19, returnedPoints: 1 })], 'pos:SALE/1'))
      .toEqual({ points: 0, reviewRequired: true });
  });
  it('returns proven known lineage and flags unknown expired purchase slices instead of guessing', () => {
    const unknown: SpentSlice = { points: 10, source: 'earn', grantedOn: '2026-01-01', expiresOn: '2026-10-15' };
    const row = evidence({ points: 30, slices: [slice(20, 'pos:SALE/1', { expiresOn: '2026-10-15' }), unknown], expiredPoints: 30 });
    expect(expiredUnusedPurchasePoints([row], 'pos:SALE/1')).toEqual({ points: 20, reviewRequired: true });
    expect(expiredUnusedPurchasePoints([evidence({ slices: null })], 'pos:SALE/1')).toEqual({ points: 0, reviewRequired: true });
    expect(expiredUnusedPurchasePoints([evidence({ slices: [slice(20, 'pos:SALE/1', { source: 'bonus', expiresOn: '2026-10-15' })] })], 'pos:SALE/1'))
      .toEqual({ points: 0, reviewRequired: true });
  });
  it('rejects inconsistent outcomes, duplicate identities and invalid lineage without a guessed exemption', () => {
    const broken = [
      evidence({ returnedPoints: null }), evidence({ expiredPoints: null }), evidence({ refundReviewRequired: true }),
      evidence({ cancelledAt: 'not-a-date' }), evidence({ points: 19 }),
      evidence({ slices: [slice(20, 'pos:SALE/1', { grantedOn: 'not-a-date', expiresOn: '2026-10-15' })] }),
    ];
    for (const row of broken) expect(expiredUnusedPurchasePoints([row], 'pos:SALE/1')).toEqual({ points: 0, reviewRequired: true });
    expect(expiredUnusedPurchasePoints([evidence(), evidence()], 'pos:SALE/1')).toEqual({ points: 0, reviewRequired: true });
    expect(() => expiredUnusedPurchasePoints([], '')).toThrow();
  });
});

describe('C5 original unused purchase-lot expiry', () => {
  it('exempts only exact-origin still-unspent expiry, never consumed amount or an unrelated grant', () => {
    const own = grantLot([], 40, 'earn', AT, undefined, '2025-10-15', 'pos:SALE/1').lots[0];
    const other = grantLot([own], 20, 'earn', AT, undefined, '2025-10-15', 'pos:OTHER').lots[1];
    const rows = [{ ...own, remaining: 15 }, other];
    expect(expiredUnusedPurchaseLotPoints(rows, 'pos:SALE/1', AT)).toEqual({ points: 15, reviewRequired: false });
    expect(expiredUnusedPurchaseLotPoints([{ ...own, remaining: 0 }], 'pos:SALE/1', AT)).toEqual({ points: 0, reviewRequired: false });
    expect(expiredUnusedPurchaseLotPoints([{ ...own, expiresOn: '2026-10-16' }], 'pos:SALE/1', AT)).toEqual({ points: 0, reviewRequired: false });
    expect(expiredUnusedPurchaseLotPoints([{ ...own, expiresOn: null }], 'pos:SALE/1', AT)).toEqual({ points: 0, reviewRequired: false });
  });
  it('flags unknown, duplicate or impossible evidence without guessing an expired allowance', () => {
    const own = grantLot([], 40, 'earn', AT, undefined, '2025-10-15', 'pos:SALE/1').lots[0];
    const unknown = { seq: own.seq, grantedOn: own.grantedOn, expiresOn: own.expiresOn,
      amount: own.amount, remaining: own.remaining, source: own.source };
    expect(expiredUnusedPurchaseLotPoints([unknown], 'pos:SALE/1', AT)).toEqual({ points: 0, reviewRequired: true });
    expect(expiredUnusedPurchaseLotPoints([own, own], 'pos:SALE/1', AT)).toEqual({ points: 0, reviewRequired: true });
    expect(expiredUnusedPurchaseLotPoints([{ ...own, remaining: 41 }], 'pos:SALE/1', AT)).toEqual({ points: 0, reviewRequired: true });
    expect(expiredUnusedPurchaseLotPoints([{ ...own, expiresOn: 'not-a-date' }], 'pos:SALE/1', AT)).toEqual({ points: 0, reviewRequired: true });
    expect(expiredUnusedPurchaseLotPoints([{ ...own, source: 'bonus' }], 'pos:SALE/1', AT)).toEqual({ points: 0, reviewRequired: true });
  });
});
