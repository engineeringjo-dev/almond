/**
 * THE REFERRAL RAIL — the rules, pure and shared.
 *
 * Owner, 2026-09-24: «خلي صاحبك ينزل التطبيق وخذ ٥٠ نقطة», redefined the same
 * day as: reward the REFERRER only, config.REFERRAL_REWARD_POINTS, ONCE PER
 * REFERRED ACCOUNT, and only when that friend's FIRST PAID order is confirmed —
 * not at signup. A signup costs an attacker a phone number; a paid order costs
 * them money. That is the whole anti-abuse argument, and it is why the grant is
 * inside the transaction that confirms the order rather than anywhere else.
 *
 * What lives here: the code's shape, the share link, the attach rule and the
 * reward amount — everything the BFF's two backends must agree on. What does
 * NOT live here: storing anything, or deciding a grant. The backend holds the
 * once-only stamp (`referrals.rewarded_at`) and applies these answers.
 */

import { config } from '../config';
import { toWesternDigits, normalizeJordanPhone } from '../lib/phone';
import { corporateEarnsPoints } from './corporate';

/** No 0/O, no 1/I/L — a code is read aloud at a counter and typed from a
 *  WhatsApp message, and those are the pairs people get wrong. */
export const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** 31^6 ≈ 8.9e8 codes: far more than members, and short enough to type. The
 *  attach route is rate-limited per member, so guessing one is not a strategy
 *  — and a guessed code only ever pays SOMEONE ELSE. */
export const REFERRAL_CODE_LENGTH = 6;

const CODE_SHAPE = new RegExp(`^[${REFERRAL_CODE_ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`);

/**
 * The code as it is STORED and compared — or `null` when it cannot be one.
 * Case, spaces, dashes and Arabic-Indic digits are forgiven (a code is copied
 * out of a chat); the alphabet and the length are not.
 */
export function normalizeReferralCode(raw: string | null | undefined): string | null {
  const c = toWesternDigits(raw ?? '').replace(/[\s-]/g, '').toUpperCase();
  return CODE_SHAPE.test(c) ? c : null;
}

/** The link a member shares. The code rides as `?ref=`; see
 *  config.REFERRAL_LINK_BASE for what does (not yet) serve it. */
export function referralShareLink(code: string, base: string = config.REFERRAL_LINK_BASE): string {
  return `${base}?ref=${encodeURIComponent(code)}`;
}

/** GET /v1/me/referral — the ONE shape the BFF sends and the app renders. */
export interface ReferralWire {
  /** The member's own code — stable: minted once, never rotated. */
  code: string;
  /** referralShareLink(code). */
  link: string;
  /** Friends who attached this code. */
  referredCount: number;
  /** …of whom this many have made their first PAID order (and so paid out). */
  rewardedCount: number;
  /** Points this member has been granted for referrals, in total. */
  pointsEarned: number;
  /** What the NEXT friend's first paid order pays — config, never a literal. */
  rewardPoints: number;
  /** The code THIS member attached as someone's friend, or null. */
  attachedCode: string | null;
  /** May this member still attach a friend's code? True only while nothing is
   *  attached AND they have no paid order yet — the attach route's own rule,
   *  reported so the screen offers the field only when it can succeed. */
  canAttach: boolean;
}

/** Why a code may not be attached. Machine codes: the route maps each to one
 *  HTTP answer and the app to one sentence. */
export type ReferralAttachError =
  | 'referral_self'
  | 'referral_same_phone'
  | 'referral_already_attached'
  | 'referral_too_late';

/**
 * May `member` attach `referrer`'s code? `null` = yes. Checked by the backend
 * UNDER THE MEMBER'S LOCK, so it and the first paid order cannot interleave.
 *
 * In order, and each one is its own test (bff/test/referral.test.ts):
 *   1. not your own code;
 *   2. not a code owned by the same phone — the same person under another
 *      account id (a re-created account, a future phone change) is still the
 *      same person;
 *   3. once: a member who has attached a code keeps it (re-attaching the SAME
 *      code is a replay, decided by the caller before asking this);
 *   4. only BEFORE the member's first paid order. After it, the event the
 *      reward is paid on has already happened, and a code attached then would
 *      be a claim on someone else's past purchase.
 */
export function referralAttachError(input: {
  memberId: string;
  memberPhone: string;
  /** When the member's first PAID order was confirmed, or null if never. */
  memberFirstPaidAt: string | null;
  /** Does this member already have a referral attached (any code)? */
  alreadyAttached: boolean;
  referrer: { id: string; phone: string };
}): ReferralAttachError | null {
  if (input.referrer.id === input.memberId) return 'referral_self';
  const a = normalizeJordanPhone(input.memberPhone);
  const b = normalizeJordanPhone(input.referrer.phone);
  if (a !== null && a === b) return 'referral_same_phone';
  if (input.alreadyAttached) return 'referral_already_attached';
  if (input.memberFirstPaidAt !== null) return 'referral_too_late';
  return null;
}

/**
 * Points the REFERRER is granted when a friend's first paid order lands.
 *
 * 🔴 A CORPORATE REFERRER IS PAID 0 — the same rule the earn engine applies
 * («من يستحق خصم دائم لا يأخذ نقاط ابدا», loyalty/corporate.ts): a member on a
 * standing discount collects no points from any source, and a referral is a
 * source. The referral is still STAMPED as rewarded (with 0), so the grant can
 * never be paid later — e.g. after the member leaves the company — for a
 * purchase made while they were on the roster.
 *
 * The FRIEND's corporate status does not matter: the friend is not paid, and
 * their first order is a real purchase either way. (Recorded in HANDOVER as a
 * choice the owner may revisit.)
 *
 * A dial that is 0 or nonsense pays 0, fail-closed like every other grant.
 */
export function referralRewardFor(
  referrerIsCorporate: boolean,
  rewardPoints: number = config.REFERRAL_REWARD_POINTS,
): number {
  // The SAME question the earn engine asks, answered in the same place.
  if (referrerIsCorporate && !corporateEarnsPoints()) return 0;
  if (!Number.isFinite(rewardPoints) || rewardPoints <= 0) return 0;
  return Math.floor(rewardPoints);
}
