import { config } from '@/constants/config';
import { comboBonusPoints } from '@/lib/combo';
import type { CartItem } from '@/types';

/**
 * Estimated points the customer will earn for this order — shown at checkout so
 * the loyalty value is visible at the moment of payment (strongest retention
 * nudge). Mirrors the deterministic levers of the server earn calculation
 * (base × wallet × tier + combo bonus). Friday / bonus-day multipliers are
 * intentionally excluded so we never over-promise.
 */
export function estimateEarnedPoints(opts: {
  total: number;
  items: CartItem[];
  tierMultiplier: number;
  paidFromBalance: boolean;
}): number {
  const walletMult = opts.paidFromBalance ? config.WALLET_EARN_MULTIPLIER : 1;
  const base = opts.total * config.POINTS_PER_JOD * walletMult;
  const tierBonus = base * (Math.max(1, opts.tierMultiplier) - 1);
  return Math.round(base + tierBonus) + comboBonusPoints(opts.items);
}
