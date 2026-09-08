import type { GiftOccasion, Tier } from '@almond/shared/types';
// The website never grants points; the earn multiplier is loyalty/earn.ts's.
// earn-arith-exempt: tier ramp for the progress display only. §7 T7.
import { tierFromSpend, nextTier, progressToNextTier } from '@almond/shared/loyalty';
import { config } from '@/lib/config';

/**
 * 🪦 THE REWARDS BOARD — DELETED 2026-09-08.
 *
 * `RewardOption`, `RUNG_TITLES` and `REWARDS` lived here: four named rewards
 * ("Coffee or bakery", "Handcrafted drink") built from the shared REWARD_RUNGS,
 * each rendered with a max-value caveat because a rung was a CAP and the member
 * could be asked for the difference at the till.
 *
 * Owner, 2026-09-08: «رح اعامل النقاط كنقود يستطيع استخدامها او الخصم من فاتورته
 * بعمل redeem لنقاطه. فهي تقلل الفاتورة او تعملها مجانية» — points are money;
 * redeeming them reduces the bill or makes it free. There is no board, no name
 * and no cap, so there is nothing for this file to hold. What the member may
 * take off their bill is now `redeemOptions(balance)` from
 * @almond/shared/loyalty/redeem — the same function the app calls, which is
 * what C12 was always really asking for.
 *
 * DO NOT REINTRODUCE A LOCAL ARRAY HERE. The defect C12 exists to catch is a
 * second board on the website, and it does not care whether the board is named
 * REWARDS or something else.
 */

/** Wallet top-up presets (JOD). */
export const TOPUP_AMOUNTS = [10, 20, 35, 50];

/** Reload bonus beans for a top-up amount — highest qualifying tier applies. */
export function reloadBonus(amount: number): number {
  let bonus = 0;
  for (const tier of config.WALLET_RELOAD_BONUS) {
    if (amount >= tier.minJOD) bonus = Math.max(bonus, tier.bonusBeans);
  }
  return bonus;
}

export interface TierProgress {
  current: Tier;
  next: Tier | null;
  ratio: number;
  remaining: number; // JOD spend to the next tier — for the BAR, never the copy
  /** What the copy says. "Spend 8.000 JOD to reach 4%" is not a sentence a
   *  member can act on; "2 more visits to reach 4%" is. Projected at the
   *  measured member basket (MEASURED_MEMBER_BASKET_JOD = 5.85). */
  visitsRemaining: number;
  /** True only where a visits door exists (the second rung). The site's
   *  `toNextTier` string is only reachable at that rung today; if a caller ever
   *  renders it above one, this is the flag that says the count is an estimate. */
  visitsGuaranteed: boolean;
  /** The multiplier step being moved toward. Carried, never rendered at the top
   *  rung: the approved copy says "×2" once and never says "×1.5". */
  step: number;
}

/** Progress through the tier ramp, over the 90-day rolling window
 *  (config.TIER_WINDOW_DAYS — see packages/shared/src/loyalty/window.ts).
 *  The website holds no spend log and no visit count of its own, so this is a
 *  spend-only projection: it cannot see the 4-visits door, and it cannot see a
 *  ratcheted member's held rung. Both are server-side facts. */
export function tierProgress(windowSpend: number): TierProgress {
  // earn-arith-exempt: tier progress display; no invoice, no grant. §7 T7.
  const current = tierFromSpend(windowSpend);
  const next = nextTier(windowSpend);
  const ratio = next
    ? (windowSpend - current.threshold) / (next.threshold - current.threshold)
    : 1;
  const projected = progressToNextTier(windowSpend);
  return {
    current,
    next,
    ratio: Math.max(0, Math.min(1, ratio)),
    remaining: next ? Math.max(0, next.threshold - windowSpend) : 0,
    // At the second rung this is now the DOOR, not the spend projection:
    // progressToNextTier reports TIER2_VISITS_ALTERNATIVE minus the days any
    // non-zero spend must already have banked, which is true at every spend
    // rather than only at zero (the projection said 1 at 15 JOD while the door
    // still needed 3). Above the second rung there is no door at all and this
    // stays an estimate — the site holds no visit count of its own, and
    // `visitsGuaranteed` is what says so out loud.
    visitsRemaining: projected?.visitsRemaining ?? 0,
    visitsGuaranteed: projected?.visitsGuaranteed ?? false,
    step: projected?.step ?? 1,
  };
}

export const GIFT_AMOUNTS = [5, 10, 15, 25];

export const GIFT_OCCASIONS: { id: GiftOccasion; ar: string; en: string }[] = [
  { id: 'birthday', ar: 'عيد ميلاد', en: 'Birthday' },
  { id: 'thankyou', ar: 'شكرًا', en: 'Thank you' },
  { id: 'congrats', ar: 'مبروك', en: 'Congrats' },
  { id: 'loveyou', ar: 'أحبك', en: 'Love you' },
  { id: 'eid', ar: 'عيد سعيد', en: 'Eid' },
  { id: 'anytime', ar: 'في أي وقت', en: 'Anytime' },
];

export function genGiftCode(): string {
  return `ALMOND-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}
