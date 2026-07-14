import { config } from '@almond/shared/config';
import { tierFromSpend } from '@almond/shared/loyalty';

/** Points earned for an order — computed on the SERVER only, reusing the shared
 *  loyalty constants so the app, the website and this service always agree.
 *  Mirrors loyalty.service.mock.ts + the MAX_EARN_MULTIPLIER cap. */
export function computeEarn(opts: {
  total: number;
  windowSpend: number;
  paidFromBalance: boolean;
  comboBonus: number;
  friday?: boolean;
}): number {
  const tier = tierFromSpend(opts.windowSpend);
  const walletMult = opts.paidFromBalance ? config.WALLET_EARN_MULTIPLIER : 1;
  const base = opts.total * config.POINTS_PER_JOD * walletMult;
  const tierBonus = base * (tier.multiplier - 1);
  const friday = opts.friday ?? new Date().getDay() === 5;
  const fridayBonus = friday ? base * 0.5 : 0;
  const cap = opts.total * config.POINTS_PER_JOD * config.MAX_EARN_MULTIPLIER;
  return Math.round(Math.min(base + tierBonus + fridayBonus, cap)) + opts.comboBonus;
}
