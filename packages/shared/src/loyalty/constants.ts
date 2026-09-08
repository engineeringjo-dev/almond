/**
 * Loyalty tiers + helpers (shared between app + web).
 *
 * The loyalty / pricing NUMBERS (POINTS_PER_JOD, redeem rate, wallet bonuses,
 * tax, cup target, …) live on the `config` object in `../config` so there is a
 * single switch file; import them from there. This module owns the tier ramp.
 *
 * THE LADDER, as adopted 2026-09-06:
 *
 *   | tier | earns          | qualifies on (90-day rolling spend) |
 *   |------|----------------|-------------------------------------|
 *   | 2%   | 2 pts/JOD      | automatic                           |
 *   | 4%   | 4 pts/JOD (×2) | 20 JOD, or 4 visits                 |
 *   | 6%   | 6 pts/JOD (×1.5)| 65 JOD                             |
 *
 * `multiplier` is the ramp against `config.POINTS_PER_JOD` (= 2), applied
 * additively in loyalty/earn.ts as `scaled × (multiplier − 1)`. So 1.0 / 2.0 /
 * 3.0 on a base of 2 yields exactly 2 / 4 / 6 points per JOD. The shape of the
 * arithmetic is unchanged from the four-tier version; only the numbers moved.
 *
 * WHY THE TIERS ARE NAMED AFTER THEIR RATE. 1 point = 1 qirsh exactly (measured
 * on 10,621 live redemptions), so the rate IS the cashback percentage and the
 * number is the most honest name available. It also carries the mechanic the
 * whole ladder rests on — "×2 then ×1.5" is a goal a member can move toward,
 * where "Silver" is only a label. Three naming schemes existed across this
 * project (Wafii's Starter/Silver/Gold/Platinum, the repo's Bean/Silver/Gold/
 * Black, and a proposal's عضو/فضّي/ذهبي); this replaces all three.
 *
 * WHY THREE AND NOT FOUR. Discriminative power over next-quarter spend, measured
 * on 160,935 earn rows: η² = 0.235 for two tiers, 0.517 for three, 0.566 for
 * four. The fourth tier buys 0.05 and costs about the same again in tier churn.
 *
 * THRESHOLDS ARE FIXED NUMBERS, NOT PERCENTILES. 20 and 65 JOD were derived from
 * the p75 (17.85) and p95 (65.85) of 90-day member spend, but they are pinned as
 * literals on purpose: the percentiles themselves drift ~10% between evaluation
 * dates, so a percentile-defined threshold would move the ladder under the
 * members standing on it.
 *
 * WHAT THIS FILE DOES NOT DO. It does not implement the 90-day window, the
 * quarterly evaluation or the visits door — `tierFromSpend` is a pure function
 * of whatever `windowSpend` its caller hands it. That window now exists, in
 * loyalty/window.ts: `qualifyingSpend()` produces the number these functions
 * take, and `standing()` is what a CALLER SHOULD USE, because it also knows
 * about the 4-visits door and about the floor a member holds.
 */
import { config } from '../config';
import type { Tier } from '../types';

export const tiers: Tier[] = [
  { id: 'base', nameAr: '٢٪', nameEn: '2%', threshold: 0, multiplier: 1.0, color: '#8C6239' },
  { id: 'plus', nameAr: '٤٪', nameEn: '4%', threshold: 20, multiplier: 2.0, color: '#C9A06A' },
  { id: 'top', nameAr: '٦٪', nameEn: '6%', threshold: 65, multiplier: 3.0, color: '#2B2B2B' },
];

export function tierFromSpend(spend: number): Tier {
  let current = tiers[0];
  for (const tier of tiers) {
    if (spend >= tier.threshold) current = tier;
  }
  return current;
}

export function nextTier(spend: number): Tier | null {
  return tiers.find((t) => t.threshold > spend) ?? null;
}

/**
 * The rung's DISPLAYED name — "٢٪" / "٤٪" / "٦٪" in Arabic, "2%" / "4%" / "6%"
 * in English. It is read off the tier itself, never out of a locale file.
 *
 * 🔴 WHY THERE IS NO `tiers.*` LOCALE NAMESPACE ANY MORE. There was one, and it
 * still held `bean / silver / gold / black` two commits after the ids became
 * base/plus/top. i18next returns the KEY when a key is missing and
 * `fallbackLng: 'ar'` does not help when ar.json is missing the same key, so
 * every `t(`tiers.${id}`)` call site rendered the literal text "tiers.base" /
 * "tiers.plus" / "tiers.top" on screen — on the badge, the rewards carousel
 * headings, the /loyalty ladder and the home card, in BOTH languages. Two
 * sources for one name is what let the locale drift past the rename; with no
 * key left there is nothing to drift, and C5 in bff/test/copy.test.ts keeps it
 * that way. almond-web has always rendered the name this way (RewardsView.tsx).
 *
 * The name IS the rate because 1 point = 1 qirsh exactly (10,621 live
 * redemptions), so it can never contradict what the member is paid: change the
 * ramp and the name changes with it.
 */
export function tierName(tier: Tier, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? tier.nameAr : tier.nameEn;
}

/** The measured member basket, from 160,935 earn rows. It is what turns a
 *  dinar threshold into a sayable number of visits. */
export const MEASURED_MEMBER_BASKET_JOD = 5.85;

/**
 * How much more spend, and how many more visits at the measured member basket,
 * until the next rung. The VISITS figure is what the member is shown: "20 JOD
 * in 90 days" is not a sayable sentence, "3 more visits" is.
 *
 * Returns null at the top of the ladder — there is nothing left to progress to,
 * and a progress bar with no destination reads as a broken one.
 *
 * ⚠ THIS IS A FUNCTION OF SPEND ALONE. It knows nothing about the 4-visits door
 * (config.TIER2_VISITS_ALTERNATIVE) and nothing about the rung a member already
 * HOLDS, so for a ratcheted member it will happily report progress toward a
 * rung they are already being paid at. Where a real member's standing is
 * available, use `standing()` in loyalty/window.ts instead; this stays for the
 * guest/website case, where all that exists is a spend figure.
 *
 * WHO RENDERS THIS. `almond-app/lib/tierCopy.ts` (via tierProgressCopy, which
 * prefers a real standing when the balance carries one) and
 * `almond-web/src/data/loyalty.ts` (which has only a spend figure and says so).
 *
 * 🔴 `visitsRemaining` AT THE SECOND RUNG IS THE VISITS DOOR, NOT THE SPEND
 * PROJECTION. It used to be `ceil(jodRemaining / 5.85)` throughout, with a
 * docstring claiming that at the second rung the projection "is a GUARANTEE and
 * the copy may promise it" because ceil(20 / 5.85) = 4 = TIER2_VISITS_ALTERNATIVE.
 * That equality holds at spend 0 AND NOWHERE ELSE: at 15 JOD the projection said
 * 1 while the door still needed up to 3, so a member who returned for a 2.50 JOD
 * americano was promised 4% and paid 2%.
 *
 * Knowing only the spend, the guaranteed count is `TIER2_VISITS_ALTERNATIVE`
 * minus the visit days already banked — and any spend at all means at least one
 * banked day (qualifying spend only accrues on days with jod > 0), so the safe
 * bound is 4 at zero spend and 3 above it. It over-states what most members
 * need, which is the only safe direction for a promise; a caller holding a real
 * standing gets the exact door from `standing()` in loyalty/window.ts instead.
 *
 * Above the second rung there is no door at all, `visitsGuaranteed` is false and
 * the count is a bare projection the copy may only ever hedge.
 *
 * `step` is returned but is deliberately NOT rendered at the top rung: the
 * approved copy says "×2" exactly once, on the promotion to 4%, and never says
 * "×1.5" (repeating a multiplier spends it).
 */
export function progressToNextTier(spend: number): {
  next: Tier;
  jodRemaining: number;
  visitsRemaining: number;
  /** True only where a visits door exists. See TierStanding.next in window.ts. */
  visitsGuaranteed: boolean;
  /** The multiplier step the member is moving toward — "×2", then "×1.5". */
  step: number;
} | null {
  const next = nextTier(spend);
  if (!next) return null;
  const current = tierFromSpend(spend);
  const jodRemaining = Math.max(0, next.threshold - spend);
  const isDoorRung = next.id === tiers[1]?.id;
  const bankedDays = spend > 0 ? 1 : 0;
  return {
    next,
    jodRemaining,
    visitsRemaining: isDoorRung
      ? Math.max(1, config.TIER2_VISITS_ALTERNATIVE - bankedDays)
      : Math.max(1, Math.ceil(jodRemaining / MEASURED_MEMBER_BASKET_JOD)),
    visitsGuaranteed: isDoorRung,
    step: next.multiplier / current.multiplier,
  };
}
