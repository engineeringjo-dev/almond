import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Brightness from 'expo-brightness';

/**
 * Max out screen brightness while `active`, and give the previous level back
 * when it stops being active (§4.3) — so a scanner reads the code first time.
 * Shared by the barcode tab (active = focused) and the earn sheet (active =
 * visible). No-op on web, and silent where brightness is unavailable.
 */
export function useMaxBrightness(active: boolean): void {
  useEffect(() => {
    if (!active || Platform.OS === 'web') return undefined;
    let previous: number | null = null;
    let live = true;
    (async () => {
      try {
        previous = await Brightness.getBrightnessAsync();
        if (live) await Brightness.setBrightnessAsync(1);
      } catch {
        // brightness unavailable — ignore
      }
    })();
    return () => {
      live = false;
      if (previous != null) Brightness.setBrightnessAsync(previous).catch(() => {});
    };
  }, [active]);
}
