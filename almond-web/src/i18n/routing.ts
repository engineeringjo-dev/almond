import { defineRouting } from 'next-intl/routing';

/**
 * Bilingual routing. Arabic is the default (RTL) — served at the root `/` with
 * no prefix; English (LTR) is served under `/en`. Mirrors the app's AR-default.
 */
export const routing = defineRouting({
  locales: ['ar', 'en'],
  defaultLocale: 'ar',
  localePrefix: 'as-needed',
});

export type AppLocale = (typeof routing.locales)[number];
