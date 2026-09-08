/**
 * WHO THE MEMBER IS, AND THE ONE-TIME BONUS FOR TELLING US.
 *
 * Owner, 2026-09-08: «٥٠ نقطة اذا بحط معلوماته وبصير الاسم مربوط باسم التعريف
 * فبتصير مثلا صباح الخير حمزة» — 50 points for filling in your details, and the
 * greeting then uses that name.
 *
 * Two separate things live here, and keeping them apart matters:
 *
 *  1. WHAT COUNTS AS COMPLETE (`isProfileComplete`). A pure predicate, shared,
 *     so the phone and the server cannot disagree about whether a member has
 *     earned the bonus. If the app thought a profile complete and the BFF did
 *     not, the member would see "+50" and hold no points.
 *
 *  2. WHAT THE NAME IS (`normalizeName`). The greeting interpolates this into a
 *     sentence, so a name of "   " must not produce "Good morning,   " and a
 *     pasted 400-character string must not become a heading. Trimming and
 *     bounding happen ONCE, here, on the way in — never at the render site,
 *     where every screen would have to remember.
 *
 * 🔴 THE BONUS IS DECIDED BY THE SERVER, NOT BY THIS MODULE. Nothing here
 * grants anything. A client that can call "my profile is complete, pay me" is a
 * mint, so the once-only stamp lives on the member record in the backend and
 * the route below it is the only thing that may write it. This module answers
 * the question; it does not authorise the payment.
 */

import { config } from '../config';

/** The fields a member fills in. `phone` is NOT here: OTP already proved it,
 *  and it is not something the member types into a profile form. */
export interface MemberProfile {
  /** Display name. Trimmed and bounded by `normalizeName` before storage. */
  name: string;
  /**
   * Amman day key ('YYYY-MM-DD'), or null.
   *
   * OPTIONAL, and deliberately not part of `isProfileComplete`. The tier cards
   * already promise a birthday benefit (`tierBenefits.birthday`), so there has
   * to be somewhere to put it — but gating 50 points on a birthdate would make
   * the bonus refusable by anyone unwilling to hand one over, which is not what
   * was asked for and is a worse trade for a coffee shop than simply having the
   * name.
   *
   * A DAY KEY, never an ISO instant: `new Date('1990-04-20')` parses as UTC
   * midnight and renders as 19 April west of Greenwich. Same rule as
   * `LoyaltyBalance.nextExpiry.on`.
   */
  birthday: string | null;
}

/** Longest name the greeting can render without becoming a paragraph. Arabic
 *  and Latin full names both sit far inside this; it exists to bound a paste,
 *  not to judge a name. */
export const MAX_NAME_LENGTH = 60;

/**
 * The name as it will be STORED and greeted with — or `''` if there is none.
 *
 * Collapses internal whitespace so "حمزة   خ" cannot be stored two ways, and
 * truncates rather than rejecting: a member who pastes their entire address
 * should get a usable greeting, not an error they cannot interpret.
 */
export function normalizeName(raw: string | null | undefined): string {
  return (raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

/**
 * Has this member told us who they are?
 *
 * A NAME, and only a name. See the `birthday` comment for why that field is not
 * part of the test.
 */
export function isProfileComplete(profile: Partial<MemberProfile> | null | undefined): boolean {
  return normalizeName(profile?.name) !== '';
}

/**
 * Points owed for completing a profile, given whether the member has ALREADY
 * been paid for it.
 *
 * Returns 0 rather than throwing when the bonus is already spent, because the
 * caller is a save handler: re-saving your own name is an ordinary thing to do
 * and must not fail, it must simply not pay again.
 *
 * `alreadyGranted` is the backend's stamp, not a client claim.
 */
export function profileBonusFor(
  profile: Partial<MemberProfile> | null | undefined,
  alreadyGranted: boolean,
  bonusPoints: number = config.PROFILE_COMPLETION_BONUS,
): number {
  if (alreadyGranted) return 0;
  if (!isProfileComplete(profile)) return 0;
  // A negative or non-finite dial pays nothing rather than minting or
  // subtracting — the same fail-closed posture as the earn guards.
  if (!Number.isFinite(bonusPoints) || bonusPoints <= 0) return 0;
  return Math.floor(bonusPoints);
}
