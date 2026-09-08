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
 * ── WHY IT DISAPPEARS RATHER THAN ANNOUNCING ITS LIMIT ──────────────────────
 *
 * The referral reward is once per account. The owner asked for that not to be
 * advertised — «بكون لمرة ١ دون ذكر ذلك» — so the pitch does not carry a
 * "once only" line, and a member is free to invite as many people as they like.
 *
 * What this module does NOT do is keep making an offer it will not honour: the
 * moment `referralRewarded` is true the challenge is gone from the banner. That
 * is the difference between not advertising a limit and misleading someone into
 * a fifth invitation expecting a fifth 50 points. The referral SCREEN, which a
 * member reaches deliberately, still states the position plainly — a person who
 * goes looking for the terms finds them.
 */

import { config } from '../config';
import { isProfileComplete, type MemberProfile } from './profile';

export type ChallengeId = 'profile' | 'referral';

/** What the member has already done. Facts from the SERVER — a challenge whose
 *  completion the client decides is a challenge the client can re-award. */
export interface ChallengeState {
  profile: Pick<MemberProfile, 'name'> | null;
  /** Has the referral reward already been paid to this account? */
  referralRewarded: boolean;
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
 * `null` is the ordinary end state, not an error: a member who has filled in
 * their details and referred someone has finished the ladder, and the banner
 * renders nothing rather than inventing a third thing to ask.
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
  //    not finished (1) — «بعد اول استخدام».
  if (!state.referralRewarded && pays(rules.referralPoints)) {
    return { id: 'referral', points: Math.floor(rules.referralPoints) };
  }

  return null;
}
