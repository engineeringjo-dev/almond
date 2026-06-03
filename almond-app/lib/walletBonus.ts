import { config } from '@/constants/config';

/**
 * Bonus beans granted for a digital wallet reload of `amount` JOD. Returns the
 * highest qualifying tier's bonus (0 if none). Shared by the mock loyalty
 * service and the wallet UI so both always agree.
 */
export function reloadBonusBeans(amount: number): number {
  return [...config.WALLET_RELOAD_BONUS]
    .sort((a, b) => b.minJOD - a.minJOD)
    .find((t) => amount >= t.minJOD)?.bonusBeans ?? 0;
}
