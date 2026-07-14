import type { Lang } from '@almond/shared/types';

// JOD (3-decimal) + number/date formatting — the same helpers the app uses.
export { formatJOD, formatNumber, formatTime, formatDate } from '@almond/shared/lib/format';

/** Coerce a next-intl locale string into the shared `Lang` union. */
export function asLang(locale: string): Lang {
  return locale === 'en' ? 'en' : 'ar';
}
