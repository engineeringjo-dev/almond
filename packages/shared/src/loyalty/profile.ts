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
import { ammanDayKey } from '../lib/ammanWeekday';
import { normalizeJordanPhone } from '../lib/phone';

/** The two answers the profile form offers. Stored as these ids and never as
 *  display text, so the Arabic and English screens cannot store two spellings
 *  of one fact. */
export const GENDERS = ['male', 'female'] as const;
export type Gender = (typeof GENDERS)[number];

/** The fields a member fills in. `phone` is NOT here: OTP already proved it,
 *  and it is not something the member types into a profile form — but it IS
 *  part of what makes a profile complete (see `ProfileFacts`). */
export interface MemberProfile {
  /** Display name. Trimmed and bounded by `normalizeName` before storage. */
  name: string;
  /**
   * Amman day key ('YYYY-MM-DD'), or null.
   *
   * 🔴 PART OF `isProfileComplete` SINCE 2026-09-24. It used to be optional on
   * the argument that gating 50 points on a birthdate makes the bonus refusable;
   * the owner decided the other way — «الاسم وتاريخ الميلاد والجنس» — because a
   * profile without it cannot carry the birthday benefit the tier cards promise.
   * The member may still save without it; they simply are not paid yet.
   *
   * A DAY KEY, never an ISO instant: `new Date('1990-04-20')` parses as UTC
   * midnight and renders as 19 April west of Greenwich. Same rule as
   * `LoyaltyBalance.nextExpiry.on`.
   */
  birthday: string | null;
  /** 'male' | 'female', or null — never display text (see GENDERS). Part of
   *  `isProfileComplete` since 2026-09-24. */
  gender: Gender | null;
}

/**
 * Everything `isProfileComplete` reads: the member's own profile fields PLUS
 * the phone the server holds for them.
 *
 * 🔴 THE PHONE IS A SERVER FACT, NEVER A FORM FIELD. Owner, 2026-09-24: the
 * bonus needs name + birth date + gender + PHONE. OTP sign-in is the only door
 * into the member table, so every member SHOULD have one — which is exactly why
 * it is an explicit condition rather than an assumption: a record that arrives
 * without one (a migration row, a future admin-created member) must not be paid
 * for a profile we cannot tie to a person. The backend passes the STORED phone;
 * a client never supplies it here.
 */
export type ProfileFacts = Partial<MemberProfile> & { phone?: string | null };

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

/** Is this a real calendar day, in 'YYYY-MM-DD', no later than today in Amman?
 *  `2026-02-31` is a shape, not a birthday; a date in the future is a typo. */
export function isValidBirthday(day: string | null | undefined, at: Date = new Date()): boolean {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const [y, m, d] = day.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  const roundTrips = probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
  return roundTrips && y >= 1900 && day <= ammanDayKey(at);
}

export function isGender(v: unknown): v is Gender {
  return typeof v === 'string' && (GENDERS as readonly string[]).includes(v);
}

/**
 * Has this member told us who they are — enough to be paid the bonus?
 *
 * 🔴 FOUR FACTS, ALL REQUIRED (owner, 2026-09-24): a NAME, a real BIRTH DATE,
 * a GENDER, and a PHONE on record. It used to be the name alone. Each one is a
 * separate condition below so that removing any of them fails a named test
 * (bff/test/profile.test.ts T33p).
 *
 * The phone is judged by the SAME Jordanian normaliser OTP sign-in stores it
 * with — a record whose phone is missing or not a Jordanian mobile is not
 * complete, whatever else it holds.
 */
export function isProfileComplete(profile: ProfileFacts | null | undefined): boolean {
  if (normalizeName(profile?.name) === '') return false;
  if (!isValidBirthday(profile?.birthday)) return false;
  if (!isGender(profile?.gender)) return false;
  if (normalizeJordanPhone(profile?.phone ?? null) === null) return false;
  return true;
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
  profile: ProfileFacts | null | undefined,
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

/**
 * THE STAMP A MIGRATED MEMBER ARRIVES WITH. Owner, 2026-09-08, asked whether the
 * Wafii import should pay the profile bonus to members whose names it already
 * carries: «لا نقود لاسم نملكه سلفاً» — no money for a name we already own.
 *
 * 🔴 THIS IS 23,860 JOD. `Member.profileBonusAt` is the only thing standing
 * between the import and a mint: PROFILE_COMPLETION_BONUS is 50 points,
 * POINTS_PER_JOD_REDEEM is 100, so the bonus is 0.500 JOD, and the export
 * carries a name for all 47,720 members. An import that leaves the stamp `null`
 * pays every one of them for a fact we already hold, in one batch, silently —
 * because `profileBonusFor` is working exactly as designed when it does.
 *
 * So the rule is a FUNCTION, not a sentence in a doc comment. A migration
 * script gets the stamp by calling this; it cannot get it by remembering to.
 *
 * WHY A STAMP AND NOT A SKIPPED PAYMENT: `profileBonusAt` is also what stops
 * the SECOND payment, when a migrated member later opens the app and saves
 * their details. Marking them settled at the cutover closes both doors with one
 * write; skipping the payment at import time but leaving `null` would only
 * defer the 23,860 JOD to the first time each member edits their name.
 *
 * A record WITHOUT a usable name returns `null` — correctly. We do not own that
 * fact, so the member is still owed the bonus if they choose to tell us.
 *
 * ⚠ SINCE 2026-09-24 "COMPLETE" IS FOUR FACTS (name, birth date, gender,
 * phone). A Wafii row carrying a name but no birth date or gender is therefore
 * NOT complete and is NOT stamped — so that member IS paid when they later add
 * the two missing facts. Whether that is right ("we own the name, not the
 * birthday") or should be stamped anyway is an OWNER decision recorded in
 * docs/HANDOVER.md §7; this function applies the predicate as written. The
 * predicate is `isProfileComplete`, the same one the save handler pays on, so
 * the import and the app can never disagree about what counts as "we have it".
 *
 * @param profile the INCOMING record, as read from the export
 * @param cutoverAt ISO instant of the migration — the same value for the batch
 */
export function migratedProfileBonusAt(
  profile: ProfileFacts | null | undefined,
  cutoverAt: string,
): string | null {
  return isProfileComplete(profile) ? cutoverAt : null;
}

/**
 * WHAT THE IN-STORE TABLET MAY SHOW ABOUT A PHONE NUMBER SOMEONE TYPED: the
 * first name and the INITIAL of the last — «حمزة العموش» → «حمزة ع.».
 *
 * 🔴 THE TABLET IS A PUBLIC SCREEN AND THE NUMBER PROVES NOTHING. Anyone can
 * type anyone's number, so what comes back must be enough for the right person
 * to recognise themselves ("yes, that's me") and not enough to learn who a
 * stranger's number belongs to. A full name would turn the tablet into a
 * reverse phone book; a first name and an initial is what a barista would say
 * out loud anyway.
 *
 * The Arabic definite article is skipped before taking the initial: the family
 * name «العموش» is known as «ع», not «ا» — every «ال…» name would otherwise
 * mask to the same letter and the initial would tell nobody anything.
 *
 * `null` when the member has told us no name (a new member is nameless on
 * purpose — see normalizeName): the tablet then shows no name at all, never an
 * invented one.
 */
export function maskedDisplayName(raw: string | null | undefined): string | null {
  const words = normalizeName(raw).split(' ').filter(Boolean);
  if (words.length === 0) return null;
  const first = words[0];
  if (words.length === 1) return first;
  const last = words[words.length - 1];
  const core = /^ال./u.test(last) ? last.slice(2) : last;
  const initial = [...core][0]?.toLocaleUpperCase() ?? '';
  return `${first} ${initial}.`;
}
