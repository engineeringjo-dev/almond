import { grantLot, lotRulesFromConfig, pruneLots, type LotSource, type PointLot } from '@almond/shared/loyalty/lots';
import { recoverPurchasePoints, type UnusedRedemptionEvidence } from '@almond/shared/loyalty';
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
 * grant/reward history stays immutable; only the net becomes spendable. */
export function grantPointCredit(
  m: Member, points: number, source: LotSource, at: Date,
  log: (line: HistoryEntry) => void, originRef?: string,
) {
  const recovery = recoverPurchasePoints(m.purchasePointsDebt, points);
  const grant = grantLot(m.lots, recovery.creditedPoints, source, at, RULES, undefined, originRef);
  m.lots = grant.lots;
  m.purchasePointsDebt = recovery.debtAfter;
  logPointsRecovery(log, recovery.recoveredPoints, at, originRef);
  return { ...grant, ...recovery };
}

export function logPointsRecovery(
  log: (line: HistoryEntry) => void, points: number, at: Date, sourceRef?: string,
): void {
  if (points === 0) return;
  log({ deltaPoints: -points, reasonAr: 'تسوية نقاط مشتريات مُرتجعة',
    reasonEn: 'Returned purchase points adjustment', createdAt: at.toISOString(),
    kind: 'refund', sourceRef: sourceRef ?? null });
}
