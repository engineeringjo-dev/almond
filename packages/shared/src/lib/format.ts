import type { Lang } from '../types';

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
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-JO-u-nu-latn' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatDate(date: string | Date, lang: Lang): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-JO-u-nu-latn' : 'en-US', {
    day: 'numeric',
    month: 'short',
  }).format(d);
}
