import type { GiftOccasion, Tier } from '@almond/shared/types';
// The website never grants points; the earn multiplier is loyalty/earn.ts's.
// earn-arith-exempt: tier ramp for the progress display only. §7 T7.
import { tierFromSpend, nextTier } from '@almond/shared/loyalty';
import { config } from '@/lib/config';

/** Catalog of beans-redeemable rewards (mock). Costs are in beans. */
export interface RewardOption {
  id: string;
  titleAr: string;
  titleEn: string;
  cost: number;
  type: 'credit' | 'free-item';
  value?: number; // JOD for credit rewards
}

export const REWARDS: RewardOption[] = [
  { id: 'credit1', titleAr: 'خصم 1 دينار', titleEn: '1 JOD off', cost: config.POINTS_PER_JOD_REDEEM, type: 'credit', value: 1 },
  { id: 'freepastry', titleAr: 'معجنات مجانية', titleEn: 'Free pastry', cost: 180, type: 'free-item' },
  { id: 'freedrink', titleAr: 'مشروب مجاني', titleEn: 'Free drink', cost: 250, type: 'free-item' },
  { id: 'credit3', titleAr: 'خصم 3 دنانير', titleEn: '3 JOD off', cost: 3 * config.POINTS_PER_JOD_REDEEM, type: 'credit', value: 3 },
];

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
  remaining: number; // JOD spend to the next tier
}

/** Progress through the rolling-12-month tier ramp. */
export function tierProgress(windowSpend: number): TierProgress {
  // earn-arith-exempt: tier progress display; no invoice, no grant. §7 T7.
  const current = tierFromSpend(windowSpend);
  const next = nextTier(windowSpend);
  const ratio = next
    ? (windowSpend - current.threshold) / (next.threshold - current.threshold)
    : 1;
  return {
    current,
    next,
    ratio: Math.max(0, Math.min(1, ratio)),
    remaining: next ? Math.max(0, next.threshold - windowSpend) : 0,
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
