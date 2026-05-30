import {
  useFonts as useExpoFonts,
} from 'expo-font';

/**
 * Font loading (section 3.2). We load via expo-font from the Google-fonts
 * Expo packages when available. To keep the project installable without the
 * optional font packages, we lazily require them and fall back to system
 * fonts if a package is missing.
 *
 * DECISION: wrap font map building in try/catch so a missing optional font
 * package never blocks app launch (operating rule 0.1 — never stop on assets).
 */
function buildFontMap(): Record<string, number> {
  const map: Record<string, number> = {};
  const safeAssign = (loader: () => Record<string, number>) => {
    try {
      Object.assign(map, loader());
    } catch {
      // Optional font package not installed — fall back to system font.
    }
  };

  safeAssign(() => {
    const f = require('@expo-google-fonts/tajawal');
    return {
      Tajawal_300Light: f.Tajawal_300Light,
      Tajawal_400Regular: f.Tajawal_400Regular,
      Tajawal_500Medium: f.Tajawal_500Medium,
      Tajawal_700Bold: f.Tajawal_700Bold,
    };
  });
  safeAssign(() => {
    const f = require('@expo-google-fonts/playfair-display');
    return {
      PlayfairDisplay_400Regular: f.PlayfairDisplay_400Regular,
      PlayfairDisplay_700Bold: f.PlayfairDisplay_700Bold,
    };
  });
  safeAssign(() => {
    const f = require('@expo-google-fonts/inter');
    return {
      Inter_400Regular: f.Inter_400Regular,
      Inter_600SemiBold: f.Inter_600SemiBold,
    };
  });

  return map;
}

export function useAppFonts(): [boolean, Error | null] {
  return useExpoFonts(buildFontMap());
}
