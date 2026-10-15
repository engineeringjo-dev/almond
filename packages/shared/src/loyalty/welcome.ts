/**
 * THE WELCOME GIFT — 200 points on the member's first purchase.
 *
 * Owner, 2026-10-15: «امنح ٢٠٠ نقطة تفعل بعد اول عملية شراء وتنزيل نقاط
 * عالتطبيق» — grant 200 points that activate after the first purchase whose
 * points land in the app.
 *
 * WHY ON THE FIRST PURCHASE AND NOT AT SIGN-UP. A gift at sign-up pays for a
 * phone number; a gift on the first purchase pays for a customer, and an
 * invented number that never buys costs nothing. It is also the moment the
 * member learns the programme works: the gift lands on the same receipt as the
 * first points. Precedent: Talabat and Careem apply their new-customer offer at
 * the first order's checkout, not at registration.
 *
 * THIS MODULE ANSWERS THE QUESTION; THE SERVER PAYS. As with the profile bonus
 * (loyalty/profile.ts), nothing here grants anything. The once-only stamp
 * (`welcomeBonusAt`) lives on the member record and is written only by the
 * backend's settlePaidOrder, in the purchase's own transaction, so a client
 * cannot ask for the gift and a refused order cannot pay it.
 */
import { config } from '../config';
import { corporateEarnsPoints } from './corporate';

/**
 * How many points the welcome gift pays this member now — 0 when there is
 * nothing to pay.
 *
 *   - `alreadyPaid` — the member's `welcomeBonusAt` stamp is set. Once, ever.
 *   - `isCorporate` — a member on a company discount earns no points at all
 *     (loyalty/corporate.ts), so the gift is 0: the SAME question the earn
 *     engine and referralRewardFor ask, answered in the same place.
 *   - a dial that is 0, negative or not a number pays 0, fail-closed like
 *     every other grant.
 */
export function welcomeBonusFor(
  alreadyPaid: boolean,
  isCorporate: boolean,
  points: number = config.WELCOME_BONUS_POINTS,
): number {
  if (alreadyPaid) return 0;
  if (isCorporate && !corporateEarnsPoints()) return 0;
  if (!Number.isFinite(points) || points <= 0) return 0;
  return Math.floor(points);
}

/** What a screen may say before the first purchase: the gift's size if the
 *  programme offers one at all, else 0 (and the screen says nothing). For
 *  copy that is shown before anyone is signed in — the onboarding slide —
 *  where there is no member to ask `welcomeBonusFor` about. */
export function welcomeBonusOffered(points: number = config.WELCOME_BONUS_POINTS): number {
  return welcomeBonusFor(false, false, points);
}

/** The history line the grant writes, in both languages — one wording, read
 *  by both backends, so the ledger cannot say it two ways. */
export const WELCOME_BONUS_REASON = { ar: 'هدية الترحيب', en: 'Welcome gift' } as const;
