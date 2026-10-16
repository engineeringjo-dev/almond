import { pointsLines } from '@almond/shared/loyalty/history';
import type { PointsLogEntry, Voucher } from '@/types';

/**
 * The numbers under two of the Rewards tab's tiles. Pure, so the node suite
 * can pin them (almond-app/test/rewardsHub.test.ts).
 */

/** The newest line of the POINTS history — the wallet's money lines are the
 *  wallet's own statement — or null when there is none. By date, not by the
 *  order the server happened to send. */
export function lastPointsMove(history: readonly PointsLogEntry[]): PointsLogEntry | null {
  let last: PointsLogEntry | null = null;
  for (const line of pointsLines(history)) {
    if (!last || Date.parse(line.createdAt) > Date.parse(last.createdAt)) last = line;
  }
  return last;
}

/** Coupons the member can still use: not used, and not past their day. */
export function activeVoucherCount(vouchers: readonly Voucher[], now: Date = new Date()): number {
  return vouchers.filter((v) => !v.used && Date.parse(v.expiresAt) > now.getTime()).length;
}
