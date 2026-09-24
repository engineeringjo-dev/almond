/**
 * THE ONBOARDING LADDER — one challenge at a time, in order.
 *
 * Owner, 2026-09-08: «اول دخول، بطلعله اول challenge: عبي معلومات وخذ ٥٠ نقطة …
 * بعد اول استخدام، خلي صاحبك ينزل التطبيق وخذ ٥٠ نقطة … وهذا بكون عالبانر».
 *
 * Two challenges, shown on the home banner: fill in your details, then invite a
 * friend. This module decides WHICH ONE — and it is pure and shared so the
 * phone, the website and any test agree about what a member is currently being
 * asked to do.
 *
 * ── WHY ONE AT A TIME ───────────────────────────────────────────────────────
 *
 * A banner is one line at the top of a screen the member came to for coffee.
 * Two offers there compete with each other and with the order button; the
 * second one is also not yet true — «بعد اول استخدام» — because a member who
 * has told us nothing about themselves is not the person to ask for their
 * friends' attention. So `nextChallenge` returns AT MOST ONE, and the order is
 * the owner's order.
 *
 * ── WHY THE REFERRAL PITCH NO LONGER DISAPPEARS ─────────────────────────────
 *
 * Until 2026-09-24 the referral reward was once per ACCOUNT and the pitch
 * vanished the moment it was paid — never re-show an offer the account can no
 * longer be paid for. The owner then made it once per REFERRED FRIEND, paid on
 * that friend's first paid order (config.REFERRAL_REWARD_POINTS): every new
 * friend who pays pays the referrer again. The offer is therefore honoured as
 * often as it is taken up, so there is no spent state to hide it on, and
 * `referralRewarded` was DELETED from ChallengeState rather than left as a
 * field nothing should read. The rule that survives is the general one: a rung
 * whose dial pays nothing is skipped.
 */

import { config } from '../config';
import { isProfileComplete, type ProfileFacts } from './profile';

export type ChallengeId = 'profile' | 'referral';

/** What the member has already done. Facts from the SERVER — a challenge whose
 *  completion the client decides is a challenge the client can re-award. */
export interface ChallengeState {
  /** What `isProfileComplete` reads — name, birth date, gender AND the phone on
   *  record (four facts since 2026-09-24). A name alone no longer finishes the
   *  first rung. */
  profile: ProfileFacts | null;
}

export interface Challenge {
  id: ChallengeId;
  /** Points the challenge pays. Rendered in the pitch, so it must be the same
   *  number the grant uses — both come from config, never from a literal in a
   *  locale string, which is how "Earn 5 points per 1 JOD" went stale. */
  points: number;
}

export interface ChallengeRules {
  profilePoints: number;
  referralPoints: number;
}

export function challengeRulesFromConfig(): ChallengeRules {
  return {
    profilePoints: config.PROFILE_COMPLETION_BONUS,
    referralPoints: config.REFERRAL_REWARD_POINTS,
  };
}

/**
 * The one challenge to put on the banner, or `null` when there is nothing left
 * to ask for.
 *
 * `null` when no rung pays anything — the ordinary way to retire the banner.
 *
 * A challenge whose points dial is 0 or nonsense is SKIPPED rather than shown
 * paying nothing — switching `PROFILE_COMPLETION_BONUS` to 0 turns that
 * challenge off, which is the documented way to retire it.
 */
export function nextChallenge(
  state: ChallengeState,
  rules: ChallengeRules = challengeRulesFromConfig(),
): Challenge | null {
  const pays = (n: number): boolean => Number.isFinite(n) && n > 0;

  // 1) First entry: tell us who you are. It comes first because it is the one
  //    the member can complete alone, in ten seconds, without needing anybody
  //    else to act.
  if (!isProfileComplete(state.profile) && pays(rules.profilePoints)) {
    return { id: 'profile', points: Math.floor(rules.profilePoints) };
  }

  // 2) After that: bring a friend. Deliberately not offered to someone who has
  //    not finished (1) — «بعد اول استخدام». Shown for as long as it pays:
  //    each friend's first paid order pays again (see the header).
  if (pays(rules.referralPoints)) {
    return { id: 'referral', points: Math.floor(rules.referralPoints) };
  }

  return null;
}
