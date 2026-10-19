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

/**
 * THE WALLET'S LINES, WORDED ONCE.
 *
 * A wallet line is a `kind: 'wallet'` line of the same ledger, holding 0 points
 * and the money it moved in `deltaFils` (signed). The amount is a number column,
 * not part of the sentence: the statement prints it as a figure, and a sum
 * over the column is the balance's history. The words for each movement are
 * here so the server's two stores and the app's mock cannot word one
 * differently (the WELCOME_BONUS_REASON arrangement).
 *
 *   topup    — the member loaded the wallet
 *   gift     — a gift card added to it
 *   refund   — money given back to it
 *   received — a balance sent by another member
 *   spend    — paid from the balance: an app order, or at the till
 *   giftBought — a gift card bought for someone, paid from the balance
 *   sent     — a balance sent to another member
 *   expire   — money that reached its expiry unspent
 */
export type WalletLineKind =
  | 'topup' | 'gift' | 'refund' | 'received' | 'spend' | 'giftBought' | 'sent' | 'expire';

export const WALLET_LINE_REASON: Record<WalletLineKind, { ar: string; en: string }> = {
  topup: { ar: 'شحن الرصيد', en: 'Wallet top-up' },
  gift: { ar: 'بطاقة هدية', en: 'Gift card' },
  refund: { ar: 'استرداد إلى الرصيد', en: 'Refund to your balance' },
  received: { ar: 'رصيد من صديق', en: 'Balance from a friend' },
  spend: { ar: 'دفع من الرصيد', en: 'Paid from your balance' },
  giftBought: { ar: 'شراء بطاقة هدية', en: 'Gift card bought' },
  sent: { ar: 'تحويل رصيد إلى صديق', en: 'Balance sent to a friend' },
  expire: { ar: 'انتهاء صلاحية رصيد', en: 'Wallet balance expired' },
};

/** Money in (+1) or money out (-1). */
export const WALLET_LINE_SIGN: Record<WalletLineKind, 1 | -1> = {
  topup: 1, gift: 1, refund: 1, received: 1, spend: -1, giftBought: -1, sent: -1, expire: -1,
};

interface LedgerLine {
  kind?: PointsKind | null;
  deltaFils?: number | null;
}

/**
 * The wallet statement: the lines that moved money, in the ledger's order
 * (newest first). A wallet line with no amount — an old line whose amount the
 * migration could not read — is left out rather than shown as 0.
 */
export function walletStatement<T extends LedgerLine>(lines: readonly T[]): T[] {
  return lines.filter((l) => l.kind === 'wallet' && typeof l.deltaFils === 'number' && l.deltaFils !== 0);
}

/** The points history: every line but the wallet's, which has its own
 *  statement. A points screen showing a top-up with no points beside it read
 *  as a line that had failed. */
export function pointsLines<T extends LedgerLine>(lines: readonly T[]): T[] {
  return lines.filter((l) => l.kind !== 'wallet');
}

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

/** A line as the points-owed note reads it. */
interface OwedLine {
  kind?: PointsKind | null;
  sourceRef?: string | null;
  branchId?: string | null;
  createdAt: string;
  pointsOwedChange?: number | null;
}

/**
 * What a history line says about points owed from a refund, or null.
 *
 * Review 2026-10-19, item 9: a refund the points balance could not cover read
 * «خصم نقاط طلب مُسترَد» with no figure, and the points it left owed were
 * later taken on a line tied to nothing. So:
 *
 *   left — a refund line that left `points` owed (its own figure is only what
 *          the balance covered, which may be 0).
 *   pays — a line that pays some of it back. `purchase` is the refunded
 *          purchase it names (the purchase line with the same `sourceRef`):
 *          its date and branch. Null when the line names none, or the
 *          purchase is not in these lines; the screen then names nothing
 *          rather than a guess.
 *
 * The server writes the figures (bff/src/backend/pointsCredit.ts); this only
 * reads them, once, for the app and the website.
 */
export type OwedNote =
  | { kind: 'left'; points: number }
  | { kind: 'pays'; purchase: { createdAt: string; branchId: string | null } | null };

export function owedNote(line: OwedLine, lines: readonly OwedLine[]): OwedNote | null {
  const change = line.pointsOwedChange ?? 0;
  if (line.kind !== 'refund' || !Number.isSafeInteger(change) || change === 0) return null;
  if (change > 0) return { kind: 'left', points: change };
  const bought = line.sourceRef
    ? lines.find((l) => l.kind === 'purchase' && l.sourceRef === line.sourceRef)
    : undefined;
  return { kind: 'pays', purchase: bought ? { createdAt: bought.createdAt, branchId: bought.branchId ?? null } : null };
}
