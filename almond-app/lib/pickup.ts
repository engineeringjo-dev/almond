import { config } from '@/constants/config';
import type { CartItem } from '@/types';

/**
 * Prep time = sum of item prep estimates, default 7 min (section 7.3).
 * We sum the per-line prep estimate (parallel prep across qty) with a floor.
 */
export function computePrepMinutes(items: CartItem[]): number {
  if (items.length === 0) return config.DEFAULT_PREP_MINUTES;
  const sum = items.reduce((s, l) => s + (l.prepMinutes ?? config.DEFAULT_PREP_MINUTES), 0);
  return Math.max(config.DEFAULT_PREP_MINUTES, sum);
}

/** Travel time = distance ÷ avg speed (section 7.3). */
export function computeTravelMinutes(distanceKm?: number): number {
  if (distanceKm == null) return 0;
  return Math.round((distanceKm / config.AVG_SPEED_KMH) * 60);
}

export interface PickupEstimate {
  prepMinutes: number;
  travelMinutes: number;
  /** True when travel ≥ prep → order will be "ready on arrival" (section 7.3 #4). */
  readyOnArrival: boolean;
}

export function computePickupEstimate(
  items: CartItem[],
  distanceKm?: number,
): PickupEstimate {
  const prepMinutes = computePrepMinutes(items);
  const travelMinutes = computeTravelMinutes(distanceKm);
  return {
    prepMinutes,
    travelMinutes,
    readyOnArrival: travelMinutes >= prepMinutes,
  };
}
