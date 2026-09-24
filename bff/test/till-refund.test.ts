import { describe, it, expect } from 'vitest';
import {
  applyTillRefund, planTillRefund, refundedShare, type RefundableSale,
} from '@almond/shared/loyalty';
import { grantLot, liveBalance, lotRulesFromConfig } from '@almond/shared/loyalty/lots';

/**
 * RF — THE REFUND RULE (packages/shared/src/loyalty/tillRefund.ts). Owner,
 * 2026-09-24: «المرتجع يلغي نقاط الجزء المرتجع» — a refund takes back the points
 * of the part refunded, in proportion to the MONEY refunded, and never more
 * than the sale earned however it is sliced.
 */
const at = new Date('2026-09-24T10:00:00Z');
const sale = (over: Partial<RefundableSale> = {}): RefundableSale => ({
  pointsEarned: 40, paidFils: 20_000, refundedFils: 0, spendDay: '2026-09-24', ...over,
});
const ok = (p: ReturnType<typeof planTillRefund>) => {
  if (!p.ok) throw new Error(`refused: ${p.reason}`);
  return p;
};

describe('RF1 the share: round(earned × refunded / paid), cumulative', () => {
  it('RF1a proportional, rounded half up, clamped to what was earned, 0 on a sale that collected nothing', () => {
    expect(refundedShare(40, 20_000, 2_000)).toBe(4);          // 10% of the money → 10% of the points
    expect(refundedShare(25, 20_000, 10_000)).toBe(13);        // 12.5 → 13 (half up)
    expect(refundedShare(40, 20_000, 20_000)).toBe(40);
    expect(refundedShare(40, 20_000, 30_000)).toBe(40);        // clamped: never more than earned
    expect(refundedShare(40, 20_000, 0)).toBe(0);
    expect(refundedShare(0, 0, 0)).toBe(0);
    expect(refundedShare(7, 0, 5)).toBe(0);
  });

  it('RF1b 🔴 however a sale is sliced, the parts never add up to more than it earned — and a full refund is exactly all of it', () => {
    // Every slicing of a 3.000 JOD sale that earned 7 into up to 30 refunds.
    for (const pieces of [2, 3, 7, 11, 29, 30]) {
      let s = sale({ pointsEarned: 7, paidFils: 3_000 });
      let taken = 0;
      const step = Math.floor(3_000 / pieces);
      for (let i = 0; i < pieces; i += 1) {
        const fils = i === pieces - 1 ? 3_000 - s.refundedFils : step;
        const p = ok(planTillRefund(s, fils));
        expect(p.targetPoints).toBeGreaterThanOrEqual(0);
        taken += p.targetPoints;
        expect(taken, `${pieces} pieces`).toBeLessThanOrEqual(7);
        s = { ...s, refundedFils: p.refundedFilsAfter };
      }
      expect(taken, `${pieces} pieces`).toBe(7);
    }
    // Per-refund rounding (what this rule is NOT) drifts: a 5-point sale
    // refunded in two halves would take round(2.5) + round(2.5) = 6 > 5.
    // Cumulative rounding takes 3, then 5 − 3 = 2.
    let s = sale({ pointsEarned: 5, paidFils: 2_000 });
    const first = ok(planTillRefund(s, 1_000));
    s = { ...s, refundedFils: first.refundedFilsAfter };
    const second = ok(planTillRefund(s, 1_000));
    expect([first.targetPoints, second.targetPoints]).toEqual([3, 2]);
  });

  it('RF1c the full reversal takes whatever is left; partials covering every fils complete the sale', () => {
    const s = { ...sale(), refundedFils: 5_000 };                  // 25% already refunded (10 points)
    const full = ok(planTillRefund(s, null));
    expect(full).toMatchObject({ targetPoints: 30, refundFils: 15_000, refundedFilsAfter: 5_000, completes: true });
    const last = ok(planTillRefund(s, 15_000));
    expect(last).toMatchObject({ targetPoints: 30, completes: true });
    expect(ok(planTillRefund(s, 1_000)).completes).toBe(false);
  });

  it('RF1d a refund larger than what is left is refused; a non-positive or fractional one throws', () => {
    expect(planTillRefund({ ...sale(), refundedFils: 15_000 }, 5_001)).toEqual({ ok: false, reason: 'refund_exceeds_sale' });
    expect(planTillRefund(sale({ paidFils: 0, pointsEarned: 0 }), 1)).toEqual({ ok: false, reason: 'refund_exceeds_sale' });
    expect(() => planTillRefund(sale(), 0)).toThrow(/positive whole number/);
    expect(() => planTillRefund(sale(), 1.5)).toThrow(/positive whole number/);
  });
});

describe('RF2 applying a refund: FIFO, never below zero, and out of the window', () => {
  const lotsOf = (n: number) => grantLot([], n, 'earn', at, lotRulesFromConfig()).lots;

  it('RF2a takes the target back FIFO; the window entry shrinks by the money refunded', () => {
    const spend = [{ jod: 20, day: '2026-09-24' }, { jod: 5, day: '2026-09-20' }];
    const p = ok(planTillRefund(sale(), 2_000));
    const r = applyTillRefund(lotsOf(100), spend, sale(), p, at);
    expect(r).toMatchObject({ reversedPoints: 4, shortfall: 0 });
    expect(liveBalance(r.lots, at)).toBe(96);
    expect(r.spend).toEqual([{ jod: 18, day: '2026-09-24' }, { jod: 5, day: '2026-09-20' }]);
    expect(spend[0].jod).toBe(20);                                   // the input is untouched
    // The next refund finds the entry by what is still counted (18), and the
    // one that covers the rest removes it.
    const after = { ...sale(), refundedFils: 2_000 };
    const rest = applyTillRefund(r.lots, r.spend, after, ok(planTillRefund(after, 18_000)), at);
    expect(rest.spend).toEqual([{ jod: 5, day: '2026-09-20' }]);
    expect(rest.reversedPoints).toBe(36);
  });

  it('RF2b 🔴 never below zero: what the member already spent is the shortfall', () => {
    const p = ok(planTillRefund(sale(), 10_000));                    // target 20
    const r = applyTillRefund(lotsOf(15), [], sale(), p, at);
    expect(r).toMatchObject({ reversedPoints: 15, shortfall: 5 });
    expect(liveBalance(r.lots, at)).toBe(0);
    const none = applyTillRefund([], [], sale(), p, at);
    expect(none).toMatchObject({ reversedPoints: 0, shortfall: 20 });
  });

  it('RF2c the full reversal of an untouched sale is exactly the old all-or-nothing reversal', () => {
    const spend = [{ jod: 20, day: '2026-09-24' }];
    const r = applyTillRefund(lotsOf(100), spend, sale(), ok(planTillRefund(sale(), null)), at);
    expect(r).toMatchObject({ reversedPoints: 40, shortfall: 0, spend: [] });
    // No window entry (a sale paid entirely with points) — nothing to remove.
    const noDay = sale({ spendDay: null });
    expect(applyTillRefund(lotsOf(10), spend, noDay, ok(planTillRefund(noDay, null)), at).spend).toEqual(spend);
  });
});
