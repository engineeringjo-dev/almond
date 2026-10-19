import { grantLot, lotRulesFromConfig, pruneLots, type LotSource, type PointLot } from '@almond/shared/loyalty/lots';
import {
  owedByPurchase, recoverPurchasePoints, splitRecovery, type OwedLedgerLine, type UnusedRedemptionEvidence,
} from '@almond/shared/loyalty';
import type { HistoryEntry, Member, TillSpend } from './types';

const RULES = lotRulesFromConfig();

/** A completed tender void is evidence of unused expiry, just like a closed
 * unused code. A spent/pending tender still delivered value and is excluded. */
export function unusedTenderEvidence(spend: TillSpend): UnusedRedemptionEvidence[] {
  if (spend.status !== 'reversed' || spend.reversedAt === null) return [];
  return [{ id: `pos-spend:${spend.posOrderRef}`, points: spend.points, slices: spend.slices,
    settledAt: null, cancelledAt: spend.reversedAt, returnedPoints: spend.returnedPoints,
    expiredPoints: spend.expiredPoints, recoveredPoints: spend.recoveredPoints ?? 0 }];
}

/** Dead, unspent purchase remainders remain evidence for a later refund;
 * retaining their dates never makes them spendable again. */
export function prunePointEvidence(lots: readonly PointLot[], at: Date): PointLot[] {
  const ordinary = new Set(pruneLots(lots, at, RULES).map((lot) => lot.seq));
  return lots.filter((lot) => ordinary.has(lot.seq) || (lot.originRef !== undefined && lot.remaining > 0))
    .map((lot) => ({ ...lot }));
}

/** Every positive points credit uses this adjustment, including gifts. Gross
 * grant/reward history stays immutable; only the net becomes spendable.
 * Owner, 2026-10-19: «من كل النقاط القادمة (كما بناه Codex)» (docs/HANDOVER.md §7). */
export function grantPointCredit(
  m: Member, points: number, source: LotSource, at: Date,
  log: (line: HistoryEntry) => void, originRef?: string,
) {
  const recovery = recoverPurchasePoints(m.purchasePointsDebt, points);
  const grant = grantLot(m.lots, recovery.creditedPoints, source, at, RULES, undefined, originRef);
  m.lots = grant.lots;
  m.purchasePointsDebt = recovery.debtAfter;
  logPointsRecovery(log, recovery.recoveredPoints, at);
  return { ...grant, ...recovery };
}

/** The words on a line that pays back points owed from a refunded purchase.
 *  «مُسترَد» is the refund's one word (review 2026-10-19, item 39); the line
 *  names the purchase in `sourceRef`, and the app says which one. */
export const OWED_PAID_REASON = { ar: 'تسوية نقاط طلب مُسترَد', en: 'Points owed on a refunded purchase' } as const;

/**
 * Points taken from an incoming credit to pay what the member owes.
 *
 * Written WITHOUT the purchase it pays: the credit that triggers it (a sale,
 * a gift, a friend's transfer, a returned redemption) does not know which
 * refund is owed. Each store's one writer names it, from the member's own
 * lines, through attributeOwedLine below.
 */
export function logPointsRecovery(log: (line: HistoryEntry) => void, points: number, at: Date): void {
  if (points === 0) return;
  log({ deltaPoints: -points, pointsOwedChange: -points, reasonAr: OWED_PAID_REASON.ar,
    reasonEn: OWED_PAID_REASON.en, createdAt: at.toISOString(), kind: 'refund', sourceRef: null });
}

/** A line that pays back points owed and does not yet name the purchase. */
export function needsOwedAttribution(e: HistoryEntry): boolean {
  return (e.pointsOwedChange ?? 0) < 0 && !e.sourceRef;
}

/**
 * NAME THE REFUNDED PURCHASE A PAYING LINE PAYS — review 2026-10-19, item 9:
 * «الخصم اللاحق يأتي كسطر غامض». Oldest refund first (loyalty/clawback.ts
 * owedByPurchase, splitRecovery), and one line per purchase, so a payment that
 * finishes one refund and starts the next is two lines, each naming its own.
 *
 * Called by each store's one history writer (memory.ts `log`, postgres.ts
 * `insertHistory`) with the member's lines as already written, oldest first.
 * Any other line comes back unchanged.
 */
export function attributeOwedLine(e: HistoryEntry, ledgerOldestFirst: readonly OwedLedgerLine[]): HistoryEntry[] {
  if (!needsOwedAttribution(e)) return [e];
  return splitRecovery(owedByPurchase(ledgerOldestFirst), -(e.pointsOwedChange ?? 0))
    .map((piece) => ({ ...e, deltaPoints: -piece.points, pointsOwedChange: -piece.points, sourceRef: piece.ref }));
}
