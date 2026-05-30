import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { I18nManager } from 'react-native';

import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import type { Lang } from '@/types';

export const LANG_STORAGE_KEY = 'almond.lang';

const resources = {
  ar: { translation: ar },
  en: { translation: en },
};

/** Pick the device language if supported, else default to Arabic (section 0/10). */
function detectInitialLang(): Lang {
  const code = Localization.getLocales()[0]?.languageCode;
  return code === 'en' ? 'en' : 'ar';
}

export function initI18n(initialLang?: Lang) {
  const lang = initialLang ?? detectInitialLang();
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      resources,
      lng: lang,
      fallbackLng: 'ar',
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v3',
    });
  }
  return i18n;
}

export function isRTL(lang: Lang): boolean {
  return lang === 'ar';
}

/**
 * Apply RTL direction. I18nManager.forceRTL requires an app reload to take
 * full effect on native; we set it so layouts using start/end mirror correctly.
 */
export function applyRTL(lang: Lang) {
  const rtl = isRTL(lang);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
    return true; // direction changed — caller may reload
  }
  return false;
}

export default i18n;
