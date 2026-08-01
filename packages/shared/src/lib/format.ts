import type { Lang } from '../types';

/**
 * Almond operates in Jordan — Asia/Amman, permanently UTC+3 (no DST since 2022).
 * Every timestamp that crosses a system boundary (order → Odoo → Ishbek → POS)
 * MUST carry this explicit offset. A bare UTC `Z` stamp read as local time lands
 * ±3h off and the order fails to reflect on the point of sale (نقطة البيع).
 */
export const AMMAN_TZ = 'Asia/Amman';

/**
 * Serialize an instant as ISO-8601 with an explicit Asia/Amman offset
 * (e.g. `2026-07-05T13:06:00.000+03:00`) — never a bare `Z`. The offset is
 * derived from the zone for the given instant, so it stays correct if the
 * rule ever changes. Use this for every order/dispatch/webhook timestamp.
 */
export function toAmmanISO(date: Date | number | string = new Date()): string {
  const d = date instanceof Date ? date : new Date(date);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: AMMAN_TZ,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  // Offset (minutes) = Amman wall-clock read as UTC, minus the real instant.
  const asUTC = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour,
    +parts.minute,
    +parts.second,
  );
  const offsetMin = Math.round((asUTC - d.getTime()) / 60000);
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const oh = String(Math.floor(abs / 60)).padStart(2, '0');
  const om = String(abs % 60).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${ms}${sign}${oh}:${om}`;
}

/**
 * Format JOD with 3 decimals (fils). AR: `X.XXX د.أ` | EN: `JOD X.XXX` (section 10).
 */
export function formatJOD(amount: number, lang: Lang): string {
  const value = amount.toFixed(3);
  return lang === 'ar' ? `${value} د.أ` : `JOD ${value}`;
}

/**
 * Integer with thousands separators (e.g. points). Uses Latin (Western) digits
 * in BOTH languages so points read consistently with prices (formatJOD), which
 * matches Jordanian commercial convention. `lang` kept for API stability.
 */
export function formatNumber(value: number, _lang: Lang): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/** Short time HH:MM for a given ISO/date. */
export function formatTime(date: string | Date, lang: Lang): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-JO' : 'en-US', {
    timeZone: AMMAN_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatDate(date: string | Date, lang: Lang): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-JO' : 'en-US', {
    timeZone: AMMAN_TZ,
    day: 'numeric',
    month: 'short',
  }).format(d);
}
