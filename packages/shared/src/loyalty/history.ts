/**
 * THE POINTS HISTORY, READ THE WAY A MEMBER READS IT.
 *
 * Owner, 2026-10-15, after Al Ameed's app: «نعمل سجل نقاط مثلهم». Their
 * history puts three counters on top (points redeemed, visits, points expired)
 * and gives every earn line its branch, its date and the day those points
 * expire. Starbucks' "Star history" does the same: what you earned, where, and
 * when it runs out.
 *
 * A line's `kind` is written by the server WHEN THE LINE IS WRITTEN, by the
 * operation that wrote it. It is never guessed back from the reason text,
 * which is copy and may be reworded. The one exception is the migration that
 * labelled lines written before the column existed
 * (supabase/migrations/20261015_point_history_detail.sql), from their exact
 * English reason.
 *
 * The counters are computed here, once, so the app and the website cannot
 * count a visit differently.
 */

/**
 * What a history line records.
 *
 *   purchase — points for paying: an app order or a till sale. A visit.
 *   redeem   — points spent: a redemption code, or points paid at the till.
 *   return   — redeemed points given back: a code cancelled or left unused
 *              until it lapsed, or a till payment voided.
 *   refund   — purchase points taken back because the purchase was refunded.
 *   expire   — points that reached their expiry date unspent.
 *   bonus    — points given, not earned by paying: the profile, a referral.
 *   transfer — points sent to, or received from, another member.
 *   wallet   — a wallet MONEY event noted in the points history (a balance
 *              sent or received, wallet money expiring). Its delta is 0.
 */
export type PointsKind =
  | 'purchase'
  | 'redeem'
  | 'return'
  | 'refund'
  | 'expire'
  | 'bonus'
  | 'transfer'
  | 'wallet';

export const POINTS_KINDS: readonly PointsKind[] = [
  'purchase', 'redeem', 'return', 'refund', 'expire', 'bonus', 'transfer', 'wallet',
];

/** The three numbers at the top of the history. */
export interface PointsSummary {
  /** Points spent on rewards, net of any given back. */
  redeemed: number;
  /** Paid purchases that earned through the loyalty account — app or till. */
  visits: number;
  /** Points that expired unspent. */
  expired: number;
}

interface SummaryLine {
  kind?: PointsKind | null;
  deltaPoints: number;
}

/**
 * Count the history the way the counters show it.
 *
 * - redeemed: what `redeem` lines took, less what `return` lines gave back —
 *   a code cancelled before it was used was not a redemption. Never below 0.
 * - visits: one per `purchase` line, including a purchase that earned 0
 *   (a corporate member, or an invoice under 1 point). A refund does not undo
 *   the visit: the member still came.
 * - expired: what `expire` lines took.
 *
 * A line with no kind (written before kinds existed and not recognised by the
 * migration) counts toward nothing.
 */
export function pointsSummary(lines: readonly SummaryLine[]): PointsSummary {
  let redeemed = 0;
  let returned = 0;
  let visits = 0;
  let expired = 0;
  for (const l of lines) {
    switch (l.kind) {
      case 'redeem':
        redeemed += Math.abs(l.deltaPoints);
        break;
      case 'return':
        returned += Math.abs(l.deltaPoints);
        break;
      case 'purchase':
        visits += 1;
        break;
      case 'expire':
        expired += Math.abs(l.deltaPoints);
        break;
      default:
        break;
    }
  }
  return { redeemed: Math.max(0, redeemed - returned), visits, expired };
}
