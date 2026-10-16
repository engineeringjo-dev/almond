import { ammanDayKey } from '../lib/ammanWeekday';
import { restoreSlices, type PointLot, type SpentSlice } from './lots';

/** Refund shortfalls are POINTS, never cash payable or wallet money. These
 * helpers recover only incoming point grants/returns, leaving existing lots
 * untouched. The backend records gross grants and recovery separately. */
export function recoverPurchasePoints(debt: number, incomingPoints: number): {
  creditedPoints: number; recoveredPoints: number; debtAfter: number;
} {
  assertCount(debt, 'debt');
  assertCount(incomingPoints, 'incomingPoints');
  const recoveredPoints = Math.min(debt, incomingPoints);
  return {
    creditedPoints: incomingPoints - recoveredPoints,
    recoveredPoints,
    debtAfter: debt - recoveredPoints,
  };
}

const POINT_SOURCES = new Set(['earn', 'bonus', 'migration', 'adjustment']);
function assertCount(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`clawback: ${name} must be a nonnegative safe integer`);
  }
}

function validDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validRef(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validSlice(slice: SpentSlice): boolean {
  return !!slice && Number.isSafeInteger(slice.points) && slice.points > 0
    && POINT_SOURCES.has(slice.source) && validDay(slice.grantedOn)
    && (slice.expiresOn === null || (validDay(slice.expiresOn) && slice.expiresOn >= slice.grantedOn))
    && (slice.originRef === undefined || validRef(slice.originRef));
}

function addCount(a: number, b: number): number {
  const sum = a + b;
  assertCount(sum, 'point total');
  return sum;
}

/** Credit ONLY the still-live incoming slice pool after recovering debt from
 * that pool. Never sweep or consume the receiver's pre-existing lots. Expired
 * incoming points cannot discharge debt because they deliver no usable value.
 * Recovery follows incoming FIFO order; every surviving slice retains its
 * original source, provenance, grant date and expiry date. */
export function creditPointSlices(
  lots: readonly PointLot[],
  slices: readonly SpentSlice[],
  debt: number,
  at: Date = new Date(),
): {
  lots: PointLot[]; returnedPoints: number; expiredPoints: number;
  recoveredPoints: number; debtAfter: number;
} {
  assertCount(debt, 'debt');
  if (!Number.isFinite(at.getTime())) throw new Error('clawback: invalid credit date');
  if (!Array.isArray(slices) || slices.some((s) => !validSlice(s))) {
    throw new Error('clawback: invalid incoming point slice');
  }
  // Validate the whole amount before constructing any credited result.
  slices.reduce((n, s) => addCount(n, s.points), 0);
  const today = ammanDayKey(at);
  let expiredPoints = 0;
  let recoveredPoints = 0;
  let debtAfter = debt;
  const credit: SpentSlice[] = [];
  const fifo = slices.map((slice, index) => ({ slice, index }))
    .sort((a, b) => a.slice.grantedOn.localeCompare(b.slice.grantedOn) || a.index - b.index);
  for (const { slice } of fifo) {
    if (slice.expiresOn !== null && slice.expiresOn < today) {
      expiredPoints = addCount(expiredPoints, slice.points);
      continue;
    }
    const back = recoverPurchasePoints(debtAfter, slice.points);
    debtAfter = back.debtAfter;
    recoveredPoints = addCount(recoveredPoints, back.recoveredPoints);
    if (back.creditedPoints > 0) credit.push({ ...slice, points: back.creditedPoints });
  }
  const back = restoreSlices(lots, credit, at);
  return { lots: back.lots, returnedPoints: back.restored, expiredPoints, recoveredPoints, debtAfter };
}

/** The original reservation and its recorded, completed cancellation result.
 * A row that was spent at the till is never evidence of unused expiry. */
export interface UnusedRedemptionEvidence {
  id: string;
  points: number;
  slices: readonly SpentSlice[] | null;
  settledAt: string | null;
  cancelledAt: string | null;
  returnedPoints: number | null;
  expiredPoints: number | null;
  recoveredPoints?: number | null;
  refundReviewRequired?: boolean;
}

/** Original purchase points that expired UNUSED outside a reservation. A
 * source-aware audit retention policy can keep these dead rows without making
 * them spendable. Only their remaining amount was unused; amount also includes
 * points already spent/transferred and must never be an exemption. */
export function expiredUnusedPurchaseLotPoints(
  lots: readonly PointLot[],
  originRef: string,
  at: Date = new Date(),
): { points: number; reviewRequired: boolean } {
  if (!validRef(originRef)) throw new Error('clawback: invalid purchase origin reference');
  if (!Number.isFinite(at.getTime())) throw new Error('clawback: invalid expiry evidence date');
  const today = ammanDayKey(at);
  const ids = new Map<number, number>();
  for (const lot of lots) ids.set(lot.seq, (ids.get(lot.seq) ?? 0) + 1);
  let points = 0;
  let reviewRequired = false;
  for (const lot of lots) {
    if (lot.remaining === 0) continue;
    if (lot.originRef !== originRef) {
      if (lot.source === 'earn' && !validRef(lot.originRef) && lot.expiresOn !== null
        && (!validDay(lot.expiresOn) || lot.expiresOn < today)) reviewRequired = true;
      continue;
    }
    if (lot.source !== 'earn' || !Number.isSafeInteger(lot.seq) || lot.seq < 0 || ids.get(lot.seq) !== 1
      || !Number.isSafeInteger(lot.amount) || lot.amount <= 0
      || !Number.isSafeInteger(lot.remaining) || lot.remaining < 0 || lot.remaining > lot.amount
      || !validDay(lot.grantedOn) || (lot.expiresOn !== null
        && (!validDay(lot.expiresOn) || lot.expiresOn < lot.grantedOn))) {
      reviewRequired = true;
      continue;
    }
    if (lot.expiresOn === null || lot.expiresOn >= today) continue;
    points = addCount(points, lot.remaining);
  }
  return { points, reviewRequired };
}

/** Proven expired, unused points from THIS original purchase only. Never
 * infer a purchase from a same-day grant or a global expired balance. Unknown
 * lineage/outcomes require reconciliation and never reduce the debt by guess.
 * Duplicate row identities are ambiguous evidence, not another exemption. */
export function expiredUnusedPurchasePoints(
  redemptions: readonly UnusedRedemptionEvidence[],
  originRef: string,
): { points: number; reviewRequired: boolean } {
  if (!validRef(originRef)) throw new Error('clawback: invalid purchase origin reference');
  let points = 0;
  let reviewRequired = false;
  const counts = new Map<string, number>();
  for (const row of redemptions) counts.set(row.id, (counts.get(row.id) ?? 0) + 1);
  for (const row of redemptions) {
    if (row.settledAt !== null || row.cancelledAt === null) continue;
    const at = new Date(row.cancelledAt);
    const recovered = row.recoveredPoints ?? 0;
    if (!validRef(row.id) || counts.get(row.id) !== 1 || !Number.isFinite(at.getTime())
      || row.refundReviewRequired || !Number.isSafeInteger(row.points) || row.points <= 0
      || row.returnedPoints === null || row.expiredPoints === null
      || !Number.isSafeInteger(row.returnedPoints) || row.returnedPoints < 0
      || !Number.isSafeInteger(row.expiredPoints) || row.expiredPoints < 0
      || !Number.isSafeInteger(recovered) || recovered < 0
      || !Array.isArray(row.slices) || row.slices.length === 0 || row.slices.some((s) => !validSlice(s))) {
      reviewRequired = true;
      continue;
    }
    const today = ammanDayKey(at);
    let total = 0;
    let expired = 0;
    let attributable = 0;
    let unknown = false;
    for (const slice of row.slices) {
      total += slice.points;
      if (slice.expiresOn === null || slice.expiresOn >= today) continue;
      expired += slice.points;
      if (slice.source === 'earn' && slice.originRef === undefined) unknown = true;
      if (slice.originRef === originRef) {
        if (slice.source === 'earn') attributable += slice.points;
        else unknown = true;
      }
    }
    if (!Number.isSafeInteger(total) || total !== row.points || expired !== row.expiredPoints
      || row.returnedPoints + recovered + expired !== row.points) {
      reviewRequired = true;
      continue;
    }
    reviewRequired ||= unknown;
    points = addCount(points, attributable);
  }
  return { points, reviewRequired };
}
