/**
 * WHICH SHEET, IF ANY, OPENS BY ITSELF — on launch, and when the app comes
 * back to the foreground.
 *
 * Two sheets may open unasked:
 *   - the thank-you after a visit (owner, 2026-10-15, after Al Ameed: «ابني
 *     لقطة التقييم واضافة النقاط») — the points the last purchase added and a
 *     rating of its branch;
 *   - «اجمع نقاطك», the till code (lib/earnSheet.ts decides whether it may).
 *
 * At most ONE, and the thank-you first: it is about something that just
 * happened and is asked once, while the code is there every launch. Each rule
 * is one line, so removing one fails a named test (test/launchSheet.test.ts).
 */
export interface LaunchInput {
  /** shouldAutoOpenEarnSheet said yes (only ever on a launch). */
  earnSheet: boolean;
  /** The server's pending visit (GET /v1/me/visit-rating), or null. */
  visitRef: string | null;
  /** The last visit the thank-you was shown for on this device. */
  lastPromptedVisitRef: string | null;
  /** The app was opened by a link or a notification, for something else. */
  launchedFromLink: boolean;
  /** A sheet is already on screen. */
  sheetOpen: boolean;
}

export type LaunchSheet = 'visit' | 'earn' | null;

export function chooseLaunchSheet(i: LaunchInput): LaunchSheet {
  if (i.sheetOpen) return null;
  if (i.launchedFromLink) return null;
  if (i.visitRef !== null && i.visitRef !== i.lastPromptedVisitRef) return 'visit';
  return i.earnSheet ? 'earn' : null;
}
