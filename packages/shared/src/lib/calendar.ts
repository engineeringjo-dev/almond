import { AMMAN_TZ } from './format';

/**
 * Jordan/Hijri calendar features for demand forecasting
 * (docs/DEMAND-FORECASTING.md §2).
 *
 * These are the covariates the forecasting engine trains on. They MUST be
 * computable for any future date (no leakage), which is why everything here is
 * derived from the calendar alone — weather and promos are logged separately.
 *
 * Ramadan cannot be encoded as a fixed Gregorian date: the Hijri year drifts
 * ~10–11 days earlier annually, so we derive it from the Umm al-Qura calendar.
 */

export type Daypart = 'morning' | 'midday' | 'afternoon' | 'evening' | 'late';

export interface CalendarFeatures {
  /** 0=Sun..6=Sat, in Amman local time. */
  dow: number;
  /** Jordan's weekend is Friday–Saturday. */
  isWeekend: boolean;
  daypart: Daypart;
  hijriYear: number;
  hijriMonth: number; // 1..12 (9 = Ramadan, 10 = Shawwal, 12 = Dhul-Hijjah)
  hijriDay: number; // 1..30
  isRamadan: boolean;
  /** 1..30 during Ramadan, else 0 — captures the within-month ramp. */
  ramadanDay: number;
  /** Eid al-Fitr (1–3 Shawwal) or Eid al-Adha (10–13 Dhul-Hijjah). */
  isEid: boolean;
  /** Days until payday (last day of month); 0 on payday itself. */
  daysToPayday: number;
  /** Universities in session (rough: Sep–Jan, Feb–Jun). */
  isUniversitySession: boolean;
}

const hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
  timeZone: AMMAN_TZ,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

/** Umm al-Qura date for an instant, read in Amman local time. */
export function hijriParts(date: Date): { year: number; month: number; day: number } {
  const p = Object.fromEntries(
    hijriFmt.formatToParts(date).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return { year: parseInt(p.year, 10), month: parseInt(p.month, 10), day: parseInt(p.day, 10) };
}

/** Gregorian Y/M/D + hour as read in Amman local time. */
function ammanParts(date: Date): { y: number; m: number; d: number; hour: number; dow: number } {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: AMMAN_TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    weekday: 'short',
  });
  const p = Object.fromEntries(
    f.formatToParts(date).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    y: parseInt(p.year, 10),
    m: parseInt(p.month, 10),
    d: parseInt(p.day, 10),
    hour: parseInt(p.hour, 10),
    dow: Math.max(0, dows.indexOf(p.weekday)),
  };
}

/** Service dayparts. Ramadan shifts demand after sunset — the engine learns
 *  that from isRamadan × daypart, so the boundaries stay fixed here. */
export function daypartOf(hour: number): Daypart {
  if (hour < 11) return 'morning';
  if (hour < 14) return 'midday';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'late';
}

export function calendarFeatures(date: Date = new Date()): CalendarFeatures {
  const g = ammanParts(date);
  const h = hijriParts(date);
  const daysInMonth = new Date(Date.UTC(g.y, g.m, 0)).getUTCDate();
  const isRamadan = h.month === 9;
  const isEid =
    (h.month === 10 && h.day >= 1 && h.day <= 3) || (h.month === 12 && h.day >= 10 && h.day <= 13);

  return {
    dow: g.dow,
    isWeekend: g.dow === 5 || g.dow === 6, // Friday–Saturday
    daypart: daypartOf(g.hour),
    hijriYear: h.year,
    hijriMonth: h.month,
    hijriDay: h.day,
    isRamadan,
    ramadanDay: isRamadan ? h.day : 0,
    isEid,
    daysToPayday: daysInMonth - g.d, // salaries land on the last working day
    isUniversitySession: g.m >= 9 || g.m <= 6, // Sep–Jan + Feb–Jun; July/Aug off
  };
}
