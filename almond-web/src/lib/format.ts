import type { Lang } from '@almond/shared/types';

// Customer money (2-decimal) + number/date formatting shared with the app.
export { formatJOD, formatNumber, formatTime, formatDate, formatDayKey } from '@almond/shared/lib/format';

/** Coerce a next-intl locale string into the shared `Lang` union. */
export function asLang(locale: string): Lang {
  return locale === 'en' ? 'en' : 'ar';
}
