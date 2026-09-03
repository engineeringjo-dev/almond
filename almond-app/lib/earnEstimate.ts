import { computeEarn, earnRulesFromConfig, type EarnRules } from '@almond/shared/loyalty/earn';
import { comboPairs } from '@/lib/combo';
import type { CartItem } from '@/types';

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
  /** Rolling-12-month qualifying spend → tier (LoyaltyBalance.windowSpend). */
  windowSpend: number;
  paidFromBalance: boolean;
}): number {
  return computeEarn(
    {
      total: opts.total,
      windowSpend: opts.windowSpend,
      paidFromBalance: opts.paidFromBalance,
      comboPairs: comboPairs(opts.items),
    },
    ESTIMATE_RULES,
  ).points;
}
