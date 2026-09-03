import { config } from '@/constants/config';
import { ammanWeekday, ammanDayKey } from '@almond/shared/lib/ammanWeekday';

export interface ActiveBonusDay {
  multiplier: number;
  labelAr: string;
  labelEn: string;
}

/**
 * The bonus-bean day config if today qualifies, else null.
 *
 * The weekday is the AMMAN business day, never the device clock (§3.6). This
 * banner promises the ×2 and computeEarn pays it, and computeEarn gates on
 * ammanWeekday() — a device on any other timezone would otherwise advertise the
 * double, accept the Activate tap, and be paid single for ~3 hours a day. That
 * is D2 reopened on the bonus-day dial. See docs/LOYALTY-EARN-PATCH.md §3.6.
 */
export function activeBonusDay(now = new Date()): ActiveBonusDay | null {
  const c = config.BONUS_BEAN_DAY;
  if (!c.enabled || !(c.weekdays as readonly number[]).includes(ammanWeekday(now))) return null;
  return { multiplier: c.multiplier, labelAr: c.labelAr, labelEn: c.labelEn };
}

/** Stable per-day key used to remember the member activated today's bonus.
 *  The same Amman day the gate above uses, so an activation and the day it
 *  belongs to can never straddle different midnights (§3.6). */
export function bonusDayKey(now = new Date()): string {
  return ammanDayKey(now);
}
