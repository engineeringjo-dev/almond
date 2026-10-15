import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

import { shouldAutoOpenEarnSheet } from '@/lib/earnSheet';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { useEarnSheetStore } from '@/stores/earnSheetStore';

/**
 * Run the launch check ONCE when Home first mounts, and open «اجمع نقاطك» if
 * lib/earnSheet.ts says so. The decision is the pure function; this hook only
 * gathers its inputs.
 *
 * "Opened by a link" means a URL with a path: a cold start can still report
 * the app's bare scheme (and Expo Go always reports one), which is a launch,
 * not a deep link. On web the page URL is always present, so it never counts.
 */
export function useAutoOpenEarnSheet(): void {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let launchedFromLink = false;
      if (Platform.OS !== 'web') {
        try {
          const url = await Linking.getInitialURL();
          const path = url ? (Linking.parse(url).path ?? '') : '';
          launchedFromLink = path.replace(/^\/+|\/+$/g, '') !== '';
        } catch {
          launchedFromLink = false;
        }
      }
      if (cancelled) return;
      const user = useAuthStore.getState().user;
      const app = useAppStore.getState();
      const sheet = useEarnSheetStore.getState();
      if (
        shouldAutoOpenEarnSheet({
          signedIn: !!user,
          isGuest: !user || user.isGuest,
          onboarded: app.hasOnboarded,
          enabled: app.autoEarnQr,
          launchedFromLink,
          shownThisLaunch: sheet.shownThisLaunch,
        })
      ) {
        sheet.open({ auto: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
