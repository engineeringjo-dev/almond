/**
 * Loyalty tiers + helpers (shared between app + web).
 *
 * The loyalty / pricing NUMBERS (POINTS_PER_JOD, redeem rate, wallet bonuses,
 * tax, cup target, …) live on the `config` object in `../config` so there is a
 * single switch file; import them from there. This module owns the tier ramp.
 *
 * Tiers (Revision Pack §A): computed from ROLLING 12-MONTH spend (not lifetime).
 * Thresholds (JOD): Bean(0) → Silver(100) → Gold(300) → Black(750).
 */
import type { Tier } from '../types';

export const tiers: Tier[] = [
  { id: 'bean', nameAr: 'بين', nameEn: 'Bean', threshold: 0, multiplier: 1.0, color: '#8C6239' },
  { id: 'silver', nameAr: 'فضي', nameEn: 'Silver', threshold: 100, multiplier: 1.25, color: '#9AA0A6' },
  { id: 'gold', nameAr: 'ذهبي', nameEn: 'Gold', threshold: 300, multiplier: 1.5, color: '#C9A06A' },
  { id: 'black', nameAr: 'أسود', nameEn: 'Black', threshold: 750, multiplier: 2.0, color: '#2B2B2B' },
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
