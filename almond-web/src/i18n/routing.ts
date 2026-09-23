import { defineRouting } from 'next-intl/routing';

/**
 * Bilingual routing. Arabic is the default (RTL) — served at the root `/` with
 * no prefix; English (LTR) is served under `/en`. Mirrors the app's AR-default.
 */
export const routing = defineRouting({
  locales: ['ar', 'en'],
  defaultLocale: 'ar',
  localePrefix: 'as-needed',
  // THE URL IS THE LANGUAGE — nothing else. With detection on, every /en/*
  // response (including the link prefetches an English page keeps making) set
  // NEXT_LOCALE=en, and an unprefixed /menu was then redirected to /en/menu on
  // the strength of that cookie. A prefetch landing between the click on
  // "العربية" and the navigation silently kept the visitor in English
  // (e2e/i18n.spec.ts). Arabic is the default and lives at `/`; English lives
  // at `/en`; the switcher links between them.
  localeDetection: false,
  localeCookie: false,
});

export type AppLocale = (typeof routing.locales)[number];
