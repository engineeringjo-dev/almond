import { useFonts as useExpoFonts } from 'expo-font';

/**
 * Font loading — Helvetica Neue.
 * We use Helvetica Neue LT Arabic, a bilingual family that contains BOTH Arabic
 * and Latin glyphs, as the single app font so Arabic and English render in
 * consistent Helvetica with no missing glyphs. Ships Light / Roman / Bold.
 */
export function useAppFonts(): [boolean, Error | null] {
  return useExpoFonts({
    'HelveticaNeueArabic-Light': require('../assets/fonts/HelveticaNeueArabic-Light.ttf'),
    'HelveticaNeueArabic-Roman': require('../assets/fonts/HelveticaNeueArabic-Roman.ttf'),
    'HelveticaNeueArabic-Bold': require('../assets/fonts/HelveticaNeueArabic-Bold.ttf'),
  });
}
