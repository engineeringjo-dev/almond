/**
 * WHETHER «اجمع نقاطك» OPENS BY ITSELF WHEN THE APP STARTS.
 *
 * Owner, 2026-10-15, after Al Ameed's app (which opens "Scan to collect
 * points" on launch): «earn points بيطلع لحالة اول ما تفتح التطبيق لازم
 * نعكسها». The commonest reason to open a café app is standing at the till;
 * the code should already be on screen.
 *
 * Every condition is a separate line so removing one fails a named test
 * (almond-app/test/earnSheet.test.ts):
 *   - a signed-in member — a guest has no code to show;
 *   - who has finished onboarding — the welcome comes first;
 *   - the member has not switched it off (Notifications › settings);
 *   - the app was not opened by a link or a notification — that member came
 *     for something else, and a sheet over it would be in the way;
 *   - once per launch — not again on every return to Home.
 */
export interface AutoOpenInput {
  signedIn: boolean;
  isGuest: boolean;
  onboarded: boolean;
  enabled: boolean;
  launchedFromLink: boolean;
  shownThisLaunch: boolean;
}

export function shouldAutoOpenEarnSheet(s: AutoOpenInput): boolean {
  if (!s.signedIn) return false;
  if (s.isGuest) return false;
  if (!s.onboarded) return false;
  if (!s.enabled) return false;
  if (s.launchedFromLink) return false;
  if (s.shownThisLaunch) return false;
  return true;
}
