/**
 * Brand theme tokens live in the shared package (single source of truth for
 * the app + website); this module re-exports them and picks the SCHEME.
 * Source: packages/shared/src/theme/index.ts.
 *
 * 🔴 THE SCHEME IS CHOSEN ONCE, AT LAUNCH, FROM THE PHONE'S SETTING. Every
 * screen builds its styles at module scope (`StyleSheet.create`), so the
 * palette must be known before the first component module loads — which is
 * here, synchronously, from `Appearance.getColorScheme()` (react-native-web
 * answers from `prefers-color-scheme`). app.json declares
 * `userInterfaceStyle: "automatic"` so the phone reports its real setting.
 *
 * A change made while the app is open takes effect at the next launch, and
 * until then the app holds the scheme it opened with — `lockColorScheme`
 * (app/_layout.tsx) pins the native views (the keyboard, alerts, the status
 * bar) to it, so nothing half-switches. Precedent: Apple HIG (Dark Mode) —
 * follow the system setting, don't offer a second one in the app.
 */
import { Appearance } from 'react-native';
import { paletteFor, shadowsFor, type ColorScheme } from '@almond/shared/theme';

export * from '@almond/shared/theme';

export const colorScheme: ColorScheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
export const colors = paletteFor(colorScheme);
export const shadow = shadowsFor(colorScheme);

/** Pin the app to the scheme it launched with (see above). A no-op where the
 *  platform has no override (the web build follows the browser). */
export function lockColorScheme(): void {
  const set = (Appearance as { setColorScheme?: (s: ColorScheme | null) => void }).setColorScheme;
  try {
    set?.(colorScheme);
  } catch {
    /* an older runtime without the override: the scheme still holds until relaunch */
  }
}
