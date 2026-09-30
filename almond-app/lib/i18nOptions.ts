import ar from '@/locales/ar.json';
import en from '@/locales/en.json';

/**
 * Kept apart from lib/i18n.ts (which loads the device locale through
 * expo-localization) so Node tests can build an instance from it.
 */
const resources = {
  ar: { translation: ar },
  en: { translation: en },
};

/**
 * The options every i18next instance here is built with — exported so the
 * plural tests run the SAME configuration the app ships.
 *
 * `compatibilityJSON: 'v3'` is deliberate: Hermes has no Intl.PluralRules,
 * and v3 carries i18next's own plural tables instead. For Arabic its keys are
 * `key_0 … key_5` = zero / one / two / few (3–10) / many (11–99) / other
 * (100+); English reads `key` (one) and `key_plural`, falling back to `key`.
 * A count-bearing string passes `count` (test/plurals.test.ts).
 */
export const I18N_OPTIONS = {
  resources,
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v3',
} as const;

