import type { Lang } from '@/types';

/**
 * Format JOD with 3 decimals (fils). AR: `X.XXX د.أ` | EN: `JOD X.XXX` (section 10).
 */
export function formatJOD(amount: number, lang: Lang): string {
  const value = amount.toFixed(3);
  return lang === 'ar' ? `${value} د.أ` : `JOD ${value}`;
}

/** Localized integer (e.g. points), with thousands separators. */
export function formatNumber(value: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-JO' : 'en-US').format(value);
}

/** Short time HH:MM for a given ISO/date. */
export function formatTime(date: string | Date, lang: Lang): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-JO' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatDate(date: string | Date, lang: Lang): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-JO' : 'en-US', {
    day: 'numeric',
    month: 'short',
  }).format(d);
}
