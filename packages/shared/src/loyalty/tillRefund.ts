/**
 * A TILL SALE, REFUNDED — IN FULL OR IN PART.
 *
 * Owner, 2026-09-24: «المرتجع يلغي نقاط الجزء المرتجع» — a refund cancels the
 * points of the part that was refunded, not the whole sale's.
 *
 * Until this module the only reversal was all-or-nothing: a member who bought
 * a 20 JOD basket and returned one 2 JOD pastry lost every point the basket
 * earned. The rule is now PROPORTIONAL to the money refunded, and it lives here
 * — pure, list-in / list-out — so the in-memory and Postgres backends cannot
 * answer a refunding till differently. (This is also where bff/src/pos/sales.ts
 * `reverseGrant` always said it belonged; it moved in the same change.)
 *
 * ── THE ARITHMETIC ─────────────────────────────────────────────────────────
 *
 *   share(F) = min(earned, round(earned × F / paid))     F = money refunded so far
 *   this refund takes back  share(before + now) − share(before)
 *
 * CUMULATIVE, NOT PER-REFUND. Rounding each refund on its own drifts: a 25-
 * point sale refunded in five equal slices would round 5 × round(2.5) = 15 or
 * 5 × 3 = 15 … or, with other amounts, MORE than was earned. Rounding the
 * running total and taking differences makes the sum of every partial refund
 * exactly `share(total refunded)`, and a refund of all the money exactly
 * `earned` — never more, whatever the slicing. `Math.round` rounds a half up.
 *
 * THE FULL REVERSAL (no amount) takes back whatever share is left:
 * `earned − share(before)`. So partial refunds followed by a full reversal
 * account for every point the sale granted, exactly once.
 *
 * NEVER BELOW ZERO. The points to take back are a TARGET; what is actually
 * taken is `min(target, live balance)`, and the rest is the `shortfall` — the
 * member already spent those points, and the back-office decides whether to
 * pursue them (the same rule the full reversal always had).
 *
 * THE WINDOW. A refund also comes out of the member's rolling 90-day spend:
 * the sale's one window entry is reduced by the money refunded (removed when
 * nothing is left), so a returned basket stops counting toward a rung. The
 * held rung is a floor and does not fall (loyalty/window.ts holdRung).
 */
import { consumeFifo, liveBalance, type PointLot } from './lots';
import { toFils, toJod } from '../lib/format';

/** The parts of a till sale the refund rule reads. */
export interface RefundableSale {
  /** Points the sale granted. */
  pointsEarned: number;
  /** Money the till collected, in fils (the part that earned). */
  paidFils: number;
  /** Money already refunded by earlier PARTIAL refunds, in fils. */
  refundedFils: number;
  /** The Amman day the sale's window spend was dated on, or null (none). */
  spendDay: string | null;
}

/** The share of a sale's points that `refundedFils` of its money carries —
 *  cumulative, clamped, and 0 for a sale that collected no money. */
export function refundedShare(pointsEarned: number, paidFils: number, refundedFils: number): number {
  if (paidFils <= 0 || refundedFils <= 0) return 0;
  return Math.min(pointsEarned, Math.round((pointsEarned * refundedFils) / paidFils));
}

export type RefundPlan =
  | {
      ok: true;
      /** Points this refund must take back (before the never-below-zero clamp). */
      targetPoints: number;
      /** Money this refund covers, in fils — for a full reversal, all that is left. */
      refundFils: number;
      /** Money refunded by partial refunds after this one (unchanged by a full reversal). */
      refundedFilsAfter: number;
      /** Nothing is left to refund after this: a full reversal, or partials that
       *  now cover every fils. The sale is then 'reversed'. */
      completes: boolean;
    }
  | { ok: false; reason: 'refund_exceeds_sale' };

/**
 * What a refund of `refundFils` (or, with `null`, the full reversal) takes.
 * Refuses a partial refund that would take the refunded money past what was
 * paid — the till is refunding more than it collected.
 */
export function planTillRefund(sale: RefundableSale, refundFils: number | null): RefundPlan {
  const before = refundedShare(sale.pointsEarned, sale.paidFils, sale.refundedFils);
  if (refundFils === null) {
    return {
      ok: true,
      targetPoints: sale.pointsEarned - before,
      refundFils: Math.max(0, sale.paidFils - sale.refundedFils),
      refundedFilsAfter: sale.refundedFils,
      completes: true,
    };
  }
  if (!Number.isInteger(refundFils) || refundFils <= 0) {
    throw new Error(`planTillRefund: refundFils must be a positive whole number of fils, got ${refundFils}`);
  }
  const after = sale.refundedFils + refundFils;
  if (after > sale.paidFils) return { ok: false, reason: 'refund_exceeds_sale' };
  return {
    ok: true,
    targetPoints: refundedShare(sale.pointsEarned, sale.paidFils, after) - before,
    refundFils,
    refundedFilsAfter: after,
    completes: after === sale.paidFils,
  };
}

/** A spend-log entry, structurally — the shape loyalty/window.ts keeps. */
export interface WindowEntry { jod: number; day: string }

export interface AppliedRefund<E extends WindowEntry> {
  lots: PointLot[];
  spend: E[];
  /** Points actually taken back — never more than the member holds live. */
  reversedPoints: number;
  /** `targetPoints − reversedPoints`: already spent, recorded, not clawed. */
  shortfall: number;
}

/**
 * Take a planned refund's points back (FIFO, never below zero) and its money
 * out of the window. Pure: new arrays, the caller's are untouched.
 */
export function applyTillRefund<E extends WindowEntry>(
  lots: readonly PointLot[],
  spend: readonly E[],
  sale: RefundableSale,
  plan: Extract<RefundPlan, { ok: true }>,
  at: Date,
): AppliedRefund<E> {
  const take = Math.min(liveBalance(lots, at), plan.targetPoints);
  let nextLots: PointLot[] = lots.map((l) => ({ ...l }));
  if (take > 0) {
    const res = consumeFifo(lots, take, at);
    // Unreachable — `take` never exceeds the live balance — but a refusal here
    // must never be mistaken for success.
    if (!res.ok) throw new Error('applyTillRefund: the live balance moved under the refund');
    nextLots = res.lots;
  }
  const nextSpend = [...spend];
  if (sale.spendDay) {
    // The sale's entry carries what is still counted: paid − already refunded.
    const counted = sale.paidFils - sale.refundedFils;
    const i = nextSpend.findIndex((e) => e.day === sale.spendDay && toFils(e.jod) === counted);
    if (i >= 0) {
      const left = counted - plan.refundFils;
      if (left > 0) nextSpend[i] = { ...nextSpend[i], jod: toJod(left) };
      else nextSpend.splice(i, 1);
    }
  }
  return { lots: nextLots, spend: nextSpend, reversedPoints: take, shortfall: plan.targetPoints - take };
}
