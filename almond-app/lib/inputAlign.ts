import { I18nManager, Platform } from 'react-native';

import { isRTL } from '@/lib/direction';
import type { Lang } from '@/types';

/**
 * WHERE A TEXT FIELD STARTS: the edge the UI reads from — right in Arabic,
 * left in English (audit P2: the promo field was pinned `textAlign: 'left'`).
 *
 * Leaving textAlign out is not enough on the web: react-native-web renders
 * every <input dir="auto">, so an EMPTY field — placeholder and caret —
 * resolves to LTR and sits at the left edge of an Arabic screen (measured on
 * the export: computed direction "ltr", text-align "start"). So the start
 * edge is said explicitly.
 *
 * Native swaps 'left'/'right' on text while the layout runs RTL (that is how
 * RN makes 'left' mean "start"), so there the value is pre-swapped whenever
 * the native direction is RTL — which also covers the moment after a language
 * switch, before forceRTL has taken effect on reload.
 */
export function inputTextAlign(
  lang: Lang,
  platform: string = Platform.OS,
  nativeRTL: boolean = I18nManager.isRTL,
): 'left' | 'right' {
  const start = isRTL(lang) ? 'right' : 'left';
  if (platform === 'web' || !nativeRTL) return start;
  return start === 'right' ? 'left' : 'right';
}
