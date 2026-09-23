import { consumeFifo, liveBalance, type PointLot } from '@almond/shared/loyalty/lots';
import type { SpendEntry } from '@almond/shared/loyalty/window';
import { HttpError, conflict } from '../http-error';
import { toFils } from '../money';
import type { TillEarnInput, TillSale } from '../backend/types';

/**
 * The rules BOTH stores apply to a till's sale — written once, here, so
 * memory.ts and postgres.ts cannot answer a retrying till differently.
 *
 * ⚠ `reverseGrant` is a money rule and belongs in @almond/shared/loyalty/lots.ts
 * beside consumeFifo (it is one caller of it). It lives in the BFF only because
 * packages/ was out of scope for this change; moving it is a pure relocation.
 */

/** The errors a till can meet, with ONE wording for both stores. */
export const earnTicketUsed = () =>
  conflict('ticket_used', 'this earn ticket was already spent on another POS order — scan the member again');
export const earnTicketExpired = () =>
  new HttpError(401, 'ticket_expired', 'this earn ticket has expired — scan the member again');
export const paidOutsideTicketWindow = () =>
  new HttpError(400, 'paid_at_outside_ticket_window', 'paidAt is not close enough to when this member was scanned — scan the member for this sale');

/** Why an earn ticket may not START a new sale (a replay ignores it). */
export type TicketRefusal = 'expired' | 'paid_outside_window';

export function ticketRefusalError(r: TicketRefusal): HttpError {
  return r === 'expired' ? earnTicketExpired() : paidOutsideTicketWindow();
}
export const posOrderConflict = () =>
  conflict('pos_order_conflict', 'this POS order reference was already reported with a different member, branch or amount');

/**
 * A second report of a POS order that already has a row: a REPLAY when it is
 * the same sale, a CONFLICT when anything the grant was computed from differs.
 * Silently replaying "Shop/0042 for 5 JOD" as the answer to "Shop/0042 for
 * 50 JOD" would tell the till the second sale earned — it did not.
 */
export function assertSameSale(sale: TillSale, input: Pick<TillEarnInput, 'memberId' | 'paidFils' | 'branchId'>): void {
  if (sale.memberId !== input.memberId || sale.paidFils !== input.paidFils || sale.branchId !== input.branchId) {
    throw posOrderConflict();
  }
}

export interface GrantReversal {
  lots: PointLot[];
  spend: SpendEntry[];
  /** Points actually taken back — never more than the member holds live. */
  reversedPoints: number;
  /** Points the sale granted that were already spent: `earned - reversed`. */
  shortfall: number;
}

/**
 * Take back what one sale granted, WITHOUT EVER GOING BELOW ZERO.
 *
 * A member who earned 40 on a sale, spent 30 of them, and then had the sale
 * refunded holds 10: the reversal takes those 10 and reports a shortfall of
 * 30. It does not overdraw the ledger (a negative lot poisons every sum — see
 * addPoints' sign guard) and it does not invent a debt the member never agreed
 * to. Whether the shortfall is pursued is a back-office decision; it is
 * recorded on the sale row so that decision can be made.
 *
 * Consumed through the SHARED FIFO rule (oldest lot first) — the same one a
 * redemption uses. The window spend the sale recorded is removed too (one
 * entry of that amount on that day), so a refunded sale stops counting toward
 * the member's rung. The HELD rung is a floor that never falls (loyalty/window
 * holdRung); a promotion the sale already caused is not taken back — see the
 * hand-over note.
 */
export function reverseGrant(
  lots: readonly PointLot[],
  spend: readonly SpendEntry[],
  sale: Pick<TillSale, 'pointsEarned' | 'paidFils' | 'spendDay'>,
  at: Date,
): GrantReversal {
  const take = Math.min(liveBalance(lots, at), sale.pointsEarned);
  let nextLots: PointLot[] = lots.map((l) => ({ ...l }));
  if (take > 0) {
    const res = consumeFifo(lots, take, at);
    // Unreachable — `take` never exceeds the live balance — but a refusal here
    // must never be mistaken for success.
    if (!res.ok) throw conflict('insufficient_points', 'Not enough points');
    nextLots = res.lots;
  }
  const nextSpend = [...spend];
  if (sale.spendDay) {
    const i = nextSpend.findIndex((e) => e.day === sale.spendDay && toFils(e.jod) === sale.paidFils);
    if (i >= 0) nextSpend.splice(i, 1);
  }
  return { lots: nextLots, spend: nextSpend, reversedPoints: take, shortfall: sale.pointsEarned - take };
}
