/**
 * WHAT A MEMBER CAN TAKE OFF THEIR BILL. One builder, two clients.
 *
 * This module replaces loyalty/rewardRungs.ts, deleted 2026-09-08. That file
 * held a BOARD — four named things at four point costs, the cheapest of them
 * config.FIRST_REWARD_POINTS — and both the app and the website rendered it as
 * a shop. Owner, on the board itself: «مافي زبون حيشتري قهوة لوز», and on what
 * replaces it: «رح اعامل النقاط كنقود يستطيع استخدامها او الخصم من فاتورته بعمل
 * redeem لنقاطه. فهي تقلل الفاتورة او تعملها مجانية» — points are money, and
 * redeeming them reduces the bill or makes it free.
 *
 * So there is nothing here to name and nothing to price. What is left is an
 * AMOUNT, and the only real questions are "how much" and "can they afford it".
 * `redeemOptions()` answers both, in one place, so the phone and the website
 * cannot offer a member two different sets of choices against one balance —
 * which is the exact defect C12 was written to catch on the old board.
 *
 * 🔴 NOTHING IN HERE IS A THRESHOLD. `full` is always present whenever the
 * member holds a single point, so the presets can never be the reason a
 * redemption is impossible. If a future edit makes any option a precondition
 * rather than a shortcut, the catalogue has come back under another name.
 */

import { config } from '../config';
import { jodFromPoints, pointsFromJod, type EarnRules } from './earn';

export interface RedeemOption {
  /** Stable id for React keys and analytics. `full` for the whole balance,
   *  `jod-2` for a 2 JOD preset. Never rendered. */
  id: string;
  /** Points this option spends. What POST /v1/loyalty/redeem is given. */
  points: number;
  /** What comes off the bill. Always jodFromPoints(points) — the value the
   *  member is shown is computed from the points actually spent, never from
   *  the preset that suggested them, so the two can never disagree by a
   *  rounding step. */
  jod: number;
  /** True for the "all of it" option. The UI labels this one differently
   *  ("رصيدك كامل" / "All my points") because "8.470 JOD" as a chip beside
   *  1/2/5 reads as a fourth preset rather than as the whole balance. */
  full: boolean;
}

/**
 * The options to offer a member holding `balancePoints`.
 *
 * Returns the affordable presets in ascending order, then the full balance —
 * and ONLY the full balance when the balance is at or below the smallest
 * preset, because a member with 60 points does not need "1 JOD (can't afford)"
 * greyed out next to "0.600 JOD, all of it". An empty array means an empty
 * balance, which is the one case with nothing to offer.
 *
 * The full-balance option is suppressed when it would duplicate a preset the
 * member can exactly afford (a balance of exactly 200 points offers "2 JOD"
 * once, not twice).
 */
export function redeemOptions(
  balancePoints: number,
  presetsJod: readonly number[] = config.REDEEM_PRESET_JOD,
  rules?: EarnRules,
): RedeemOption[] {
  const balance = Math.max(0, Math.floor(balancePoints || 0));
  if (balance <= 0) return [];

  const out: RedeemOption[] = [];
  for (const jod of [...presetsJod].sort((a, b) => a - b)) {
    const points = pointsFromJod(jod, rules);
    if (points <= 0 || points > balance) continue;
    // Not `jod`: what the member is charged is `points`, so what they are shown
    // has to be what `points` is worth. See the field comment.
    out.push({ id: `jod-${jod}`, points, jod: jodFromPoints(points, rules), full: false });
  }

  const already = out.some((o) => o.points === balance);
  if (!already) {
    out.push({ id: 'full', points: balance, jod: jodFromPoints(balance, rules), full: true });
  } else {
    // The member can afford a preset EXACTLY and it is their whole balance.
    // Label that one as the full balance rather than adding a duplicate row.
    out[out.length - 1].full = true;
  }

  return out;
}
