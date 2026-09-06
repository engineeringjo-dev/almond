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
 * WHAT THIS FILE DOES NOT DO. It does not implement the 90-day window or the
 * quarterly evaluation — `tierFromSpend` is a pure function of whatever
 * `windowSpend` its caller supplies, and today's callers still supply a
 * rolling-12-month figure (the app) or an ever-accumulating one (the BFF's
 * `addSpend`, which never rolls anything off). See config.TIER_WINDOW_DAYS.
 */
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
 * How much more spend, and how many more visits at the measured member basket,
 * until the next rung. The VISITS figure is what the member is shown: "20 JOD
 * in 90 days" is not a sayable sentence, "3 more visits" is.
 *
 * Returns null at the top of the ladder — there is nothing left to progress to,
 * and a progress bar with no destination reads as a broken one.
 */
export const MEASURED_MEMBER_BASKET_JOD = 5.85;

export function progressToNextTier(spend: number): {
  next: Tier;
  jodRemaining: number;
  visitsRemaining: number;
  /** The multiplier step the member is moving toward — "×2", then "×1.5". */
  step: number;
} | null {
  const next = nextTier(spend);
  if (!next) return null;
  const current = tierFromSpend(spend);
  const jodRemaining = Math.max(0, next.threshold - spend);
  return {
    next,
    jodRemaining,
    visitsRemaining: Math.max(1, Math.ceil(jodRemaining / MEASURED_MEMBER_BASKET_JOD)),
    step: next.multiplier / current.multiplier,
  };
}
