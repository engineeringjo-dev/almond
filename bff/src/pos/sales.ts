import { planTillRefund, type RefundableSale } from '@almond/shared/loyalty';
import { HttpError, conflict } from '../http-error';
import type { TillEarnInput, TillRefund, TillRefundInput, TillSale, TillSpend, TillSpendInput } from '../backend/types';

/**
 * The rules BOTH stores apply to a till's sale — written once, here, so
 * memory.ts and postgres.ts cannot answer a retrying till differently.
 *
 * The refund ARITHMETIC (what a full or partial refund takes back, and out of
 * the window) is a money rule and lives in @almond/shared/loyalty/tillRefund.ts
 * — it replaced `reverseGrant`, which used to sit here. What stays here is the
 * wording and the replay/conflict decisions both stores must make alike.
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
/** The spend ticket's own wording — same machine codes as the earn ticket, so
 *  the till's handling ("scan the member again") is one rule. */
export const spendTicketUsed = () =>
  conflict('ticket_used', 'this spend ticket was already used on another POS order — scan the member again');
export const spendTicketExpired = () =>
  new HttpError(401, 'ticket_expired', 'this spend ticket has expired — spending points needs a fresh scan of the member');
export const posSpendConflict = () =>
  conflict('pos_order_conflict', 'this POS order reference already spent points for a different member or amount');

/** A second spend report for a POS order that already has one: a REPLAY when
 *  it is the same spend, a CONFLICT otherwise — never a second debit. */
export function assertSameSpend(spend: Pick<TillSpend, 'memberId' | 'points'>, input: Pick<TillSpendInput, 'memberId' | 'points'>): void {
  if (spend.memberId !== input.memberId || spend.points !== input.points) throw posSpendConflict();
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

// ---- refunds (POST /v1/pos/earn/reverse) ----

export const refundConflict = () =>
  conflict('refund_conflict', 'this refund reference was already reported for a different sale or amount');
export const refundExceedsSale = () =>
  conflict('refund_exceeds_sale', 'this refund is larger than what is left to refund on the sale');
export const saleAlreadyReversed = () =>
  conflict('sale_already_reversed', 'this sale was already reversed in full — nothing is left to refund');

/** The sale as the shared refund rule reads it. */
export const refundable = (sale: TillSale): RefundableSale => ({
  pointsEarned: sale.pointsEarned, paidFils: sale.paidFils, refundedFils: sale.refundedFils, spendDay: sale.spendDay,
});

/** A stored refund found again: a REPLAY when it is the same refund, a
 *  CONFLICT when the till reused its reference for anything else. */
export function assertSameRefund(found: TillRefund, posOrderRef: string, input: TillRefundInput): void {
  if (found.posOrderRef !== posOrderRef || found.refundedFils !== input.refundedFils) throw refundConflict();
}

/** The plan for this call, or the refusal both stores give. */
export function planOrRefuse(sale: TillSale, input: TillRefundInput | undefined) {
  const plan = planTillRefund(refundable(sale), input ? input.refundedFils : null);
  if (!plan.ok) throw refundExceedsSale();
  return plan;
}

/**
 * The answer to a FULL reversal of a sale that is already 'reversed' but has
 * no full-reversal row: reversed before refunds had rows (20260930), or
 * reversed by partial refunds that covered every fils. Nothing is left, so it
 * is a replay, and it reports the sale's own totals.
 */
export function syntheticFullRefund(sale: TillSale): TillRefund {
  return {
    refundRef: null, posOrderRef: sale.posOrderRef, memberId: sale.memberId,
    refundedFils: sale.paidFils - sale.refundedFils,
    targetPoints: (sale.reversedPoints ?? 0) + (sale.shortfall ?? 0),
    reversedPoints: sale.reversedPoints ?? 0, shortfall: sale.shortfall ?? 0,
    balanceAfter: sale.reverseBalanceAfter ?? 0, reason: sale.reverseReason ?? '',
    createdAt: sale.reversedAt ?? sale.createdAt,
  };
}

/** The ledger wording for a refund, full or partial. */
export function refundReasons(partial: boolean): { reasonAr: string; reasonEn: string } {
  return partial
    ? { reasonAr: 'استرجاع نقاط جزء مُسترد', reasonEn: 'Partially refunded purchase points' }
    : { reasonAr: 'استرجاع نقاط طلب مُسترد', reasonEn: 'Refunded purchase points' };
}
