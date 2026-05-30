import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores/appStore';
import type { Lang } from '@/types';

/**
 * Convenience hook: translation function + current language + RTL flag.
 * Use everywhere instead of hardcoding strings (operating rule 0.4).
 */
export function useI18n() {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang) as Lang;
  return { t, lang, isRTL: lang === 'ar' };
}
