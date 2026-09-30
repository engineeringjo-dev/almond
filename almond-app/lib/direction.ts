import { I18nManager, Platform } from 'react-native';

import type { Lang } from '@/types';

/**
 * LAYOUT DIRECTION — kept apart from lib/i18n.ts (which loads the device
 * locale through expo-localization) so the rules below are plain functions.
 */

export function isRTL(lang: Lang): boolean {
  return lang === 'ar';
}

/** The root attributes a document in `lang` must carry. */
export function documentDirection(lang: Lang): { lang: Lang; dir: 'rtl' | 'ltr' } {
  return { lang, dir: isRTL(lang) ? 'rtl' : 'ltr' };
}

/**
 * WEB ONLY: put the language and direction on <html>.
 *
 * I18nManager.forceRTL is a no-op in react-native-web, so the web build shipped
 * LTR with `lang="en"` in Arabic: «الرئيسية» leftmost in the tab bar, amounts
 * on the wrong side, and screen readers reading Arabic with an English voice
 * (audit P1, WCAG 3.1.1). react-native-web lays rows and start/end out from the
 * CSS direction, so `dir` on the root mirrors the whole app the way forceRTL
 * mirrors it natively — no per-component flipping.
 */
export function applyDocumentDirection(
  lang: Lang,
  doc: { documentElement: { lang: string; dir: string } } | undefined =
    typeof document === 'undefined' ? undefined : document,
): void {
  if (Platform.OS !== 'web' || !doc) return;
  const attrs = documentDirection(lang);
  doc.documentElement.lang = attrs.lang;
  doc.documentElement.dir = attrs.dir;
}

/**
 * Does the platform already lay rows out in `lang`'s reading direction?
 *
 * Web: always, once applyDocumentDirection has set <html dir>. Native: only
 * when I18nManager's direction matches the language — forceRTL takes effect
 * after a reload, so right after a language switch it may not yet. A component
 * that flips by hand must flip ONLY when this is false, or it mirrors twice
 * (audit: ListRow reversed unconditionally; profile.tsx flipped on web only).
 */
export function layoutFollowsLanguage(
  lang: Lang,
  platform: string = Platform.OS,
  nativeRTL: boolean = I18nManager.isRTL,
): boolean {
  return platform === 'web' || nativeRTL === isRTL(lang);
}
