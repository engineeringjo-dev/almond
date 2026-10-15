import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as Linking from 'expo-linking';

import { shouldAutoOpenEarnSheet } from '@/lib/earnSheet';
import { chooseLaunchSheet } from '@/lib/launchSheet';
import { loyaltyService } from '@/services/loyalty.service';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { useEarnSheetStore } from '@/stores/earnSheetStore';
import { useVisitSheetStore } from '@/stores/visitSheetStore';
import type { PendingVisit } from '@almond/shared/loyalty/visitRating';

/** How long a launch waits for the pending visit before opening the code
 *  sheet without it: the code must not hang on a slow network. */
const VISIT_LOOKUP_TIMEOUT_MS = 2500;

/**
 * Run the open-by-itself check when Home first mounts, and again each time
 * the app comes back to the foreground. lib/launchSheet.ts decides which sheet
 * (the thank-you after a visit, or «اجمع نقاطك»); this hook only gathers the
 * inputs and opens what it says.
 *
 * "Opened by a link" means a URL with a path: a cold start can still report
 * the app's bare scheme (and Expo Go always reports one), which is a launch,
 * not a deep link. On web the page URL is always present, so it never counts.
 */
export function useLaunchSheets(): void {
  useEffect(() => {
    let cancelled = false;

    const pendingVisit = async (userId: string): Promise<PendingVisit | null> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          loyaltyService.getPendingVisit(userId),
          new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), VISIT_LOOKUP_TIMEOUT_MS); }),
        ]);
      } catch {
        return null;           // the thank-you is a courtesy; never an error
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    const check = async (launch: boolean) => {
      let launchedFromLink = false;
      if (launch && Platform.OS !== 'web') {
        try {
          const url = await Linking.getInitialURL();
          const path = url ? (Linking.parse(url).path ?? '') : '';
          launchedFromLink = path.replace(/^\/+|\/+$/g, '') !== '';
        } catch {
          launchedFromLink = false;
        }
      }
      const user = useAuthStore.getState().user;
      const member = !!user && !user.isGuest && useAppStore.getState().hasOnboarded;
      const visit = member && !launchedFromLink ? await pendingVisit(user.id) : null;
      if (cancelled) return;

      const app = useAppStore.getState();
      const earn = useEarnSheetStore.getState();
      const visitSheet = useVisitSheetStore.getState();
      const choice = chooseLaunchSheet({
        earnSheet: launch && shouldAutoOpenEarnSheet({
          signedIn: !!user,
          isGuest: !user || user.isGuest,
          onboarded: app.hasOnboarded,
          enabled: app.autoEarnQr,
          launchedFromLink,
          shownThisLaunch: earn.shownThisLaunch,
        }),
        visitRef: visit?.ref ?? null,
        lastPromptedVisitRef: app.lastVisitPrompt,
        launchedFromLink,
        sheetOpen: earn.visible || visitSheet.visit !== null,
      });
      if (choice === 'visit' && visit) {
        // Marked when SHOWN, not when rated: a member who waves it away is
        // not asked about the same visit again.
        app.setLastVisitPrompt(visit.ref);
        visitSheet.open(visit);
      } else if (choice === 'earn') {
        earn.open({ auto: true });
      }
    };

    void check(true);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check(false);
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}
