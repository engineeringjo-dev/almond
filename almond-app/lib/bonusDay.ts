import { config } from '@/constants/config';

export interface ActiveBonusDay {
  multiplier: number;
  labelAr: string;
  labelEn: string;
}

/** The bonus-bean day config if today qualifies, else null. */
export function activeBonusDay(now = new Date()): ActiveBonusDay | null {
  const c = config.BONUS_BEAN_DAY;
  if (!c.enabled || !(c.weekdays as readonly number[]).includes(now.getDay())) return null;
  return { multiplier: c.multiplier, labelAr: c.labelAr, labelEn: c.labelEn };
}

/** Stable per-day key used to remember the member activated today's bonus. */
export function bonusDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
