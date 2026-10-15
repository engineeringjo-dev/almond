import { computeEarn, earnRulesFromConfig, type EarnRules } from '@almond/shared/loyalty/earn';
import { cartLineFor } from '@almond/shared/cart';
import { comboBasket } from '@/lib/combo';
import type { CartItem, MenuItem } from '@/types';

/**
 * Estimated points the customer will earn for this order — shown at checkout so
 * the loyalty value is visible at the moment of payment (strongest retention
 * nudge).
 *
 * The arithmetic is the SHARED earn function; nothing is re-implemented here
 * (docs/LOYALTY-EARN-PATCH.md §3.5 row 5). The one deliberate difference is the
 * `weekdayBonus: []` override: today's estimate omits the Friday bonus "so we
 * never over-promise", and showing it would move a Bean 7.20 JOD Friday basket
 * from 36 to 54 displayed points. That is a marketing decision held in §8.9 —
 * until it is made, the displayed number stays exactly what it is today while
 * the formula behind it lives in one place. Drop the override to ship §8.9.
 *
 * The bonus-day multiplier is excluded for the same reason and by default:
 * `bonusDayActivated` is not passed, so it is false.
 *
 * The `: EarnRules` annotation is load-bearing, not decoration: without a
 * contextual type there is no excess-property check, so a misspelled override
 * key would compile clean, the spread would supply the real `weekdayBonus`, and
 * §8.9's Friday bonus would silently start appearing at checkout.
 *
 * Exported so the app's test can bind the displayed estimate to the shared
 * function by VALUE against the very rules the app ships (§7 T7).
 */
export const ESTIMATE_RULES: EarnRules = { ...earnRulesFromConfig(), weekdayBonus: [] };

export function estimateEarnedPoints(opts: {
  total: number;
  items: CartItem[];
  /** Qualifying spend inside the 90-day window (LoyaltyBalance.windowSpend). */
  windowSpend: number;
  /** The rung the member HOLDS (LoyaltyBalance.tier). Optional, but omitting it
   *  under-quotes a ratcheted member: their window may have rolled below the
   *  threshold they once crossed while they are still PAID the higher rate, and
   *  the estimate must equal the grant. */
  heldRungId?: string;
  paidFromBalance: boolean;
}): number {
  return computeEarn(
    {
      total: opts.total,
      windowSpend: opts.windowSpend,
      heldRungId: opts.heldRungId,
      paidFromBalance: opts.paidFromBalance,
      // On the invoice's own basis: the pair earns the combo INSTEAD of its
      // regular points, so the estimate must know what the pair costs.
      combo: comboBasket(opts.items, opts.total),
    },
    ESTIMATE_RULES,
  ).points;
}

/** The order's points as the cart quotes them — the member's rung, the payment
 *  chosen, any promo — for whatever lines it is handed. */
export type PointsFor = (lines: CartItem[]) => number;

/**
 * What one tap on the cart's combo banner does to the order's points, or null
 * when it does not raise them.
 *
 * 🔴 THE BANNER SAID «واكسب 50 نقطة» WHATEVER ADDING THE ITEM DID. The 50
 * REPLACES the pair's regular points (owner, 2026-09-24), so adding the item
 * LOWERS the order's points whenever the drink alone already earns more than
 * 50. Measured on «لاتيه الموند ساخن» (3.50) and «قطعة بريوش التفاح» (1.90):
 * a 6% member paying from the balance earns 63 for the latte on a double-
 * points day and 50 once the brioche is added; on an ordinary day the same
 * happens to any drink above 5.56 JOD. The banner told those members to pay
 * 1.90 JOD more and lose 13 points (Dunkin' panel, 2026-10-15).
 *
 * Now it states the order's points with the item and without, computed by the
 * same estimate the summary shows, and it is not shown at all when the first
 * is not larger. Precedent: Starbucks and Dunkin' bonuses are added on top of
 * what the purchase earns, so a nudge to add one never lowers the total.
 */
export function comboGain(
  pointsFor: PointsFor,
  items: CartItem[],
  item: MenuItem,
): { before: number; after: number } | null {
  const size = item.sizes[0];
  if (!size) return null;
  const before = pointsFor(items);
  const after = pointsFor([...items, cartLineFor(item, size, [], 1)]);
  return after > before ? { before, after } : null;
}
