import type { GiftOccasion, Tier } from '@almond/shared/types';
// The website never grants points; the earn multiplier is loyalty/earn.ts's.
// earn-arith-exempt: tier ramp for the progress display only. §7 T7.
import { tierFromSpend, nextTier, progressToNextTier } from '@almond/shared/loyalty';
import { REWARD_RUNGS, rungValueJod } from '@almond/shared/loyalty/rewardRungs';
import { config } from '@/lib/config';

/** Catalog of beans-redeemable rewards. Costs are in beans. */
export interface RewardOption {
  id: string;
  titleAr: string;
  titleEn: string;
  cost: number;
  type: 'credit' | 'free-item';
  /** The JOD the rung is worth. A MAXIMUM, not a price: the member pays the
   *  difference if the item costs more. `Rewards.maxValueHint` says so. */
  value?: number;
}

/** The approved name of each shared rung, in both languages. These are the same
 *  strings almond-app renders from `rewardItems.*` — the website stores the
 *  title on the voucher it mints, so it carries them literally rather than by
 *  key. If they diverge from the app's locale files, one account has two names
 *  for one reward. */
const RUNG_TITLES: Record<string, { ar: string; en: string }> = {
  customization: { ar: 'تخصيص مجاني (شوت/نكهة)', en: 'Free customization (shot/syrup)' },
  brewedCoffee: { ar: 'قهوة أو معجنات', en: 'Coffee or bakery' },
  handcraftedDrink: { ar: 'مشروب مميّز محضّر', en: 'Handcrafted drink' },
  packagedCoffee: { ar: 'قهوة مغلّفة أو هدية', en: 'Packaged coffee or gift' },
};

/**
 * THE BOARD, BUILT FROM THE SHARED RUNGS — never retyped here.
 *
 * It used to be a local array of 100 / 180 / 250 / 300 offering "Free pastry"
 * and "Free drink". Against the menu this very site serves, 250 points = 2.500
 * JOD covers 4 of 69 drinks (5.8%) and 180 points = 1.800 JOD covers 4 of 152
 * food items (2.6%) — so a member who redeemed 250 here expecting any drink met
 * a 2.500 JOD cap at the till, while the app called the same rung "Coffee or
 * bakery" and put a real handcrafted drink at 400. The site's own copy says one
 * account across web and app; the boards have to be the same board.
 */
export const REWARDS: RewardOption[] = REWARD_RUNGS.map((rung) => ({
  id: rung.labelKey,
  titleAr: RUNG_TITLES[rung.labelKey].ar,
  titleEn: RUNG_TITLES[rung.labelKey].en,
  cost: rung.points,
  // Every rung is redeemed as an item, capped at its value; none of them is
  // cash. Beans have no cash value and are never converted to wallet money.
  type: 'free-item',
  value: rungValueJod(rung),
}));

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
