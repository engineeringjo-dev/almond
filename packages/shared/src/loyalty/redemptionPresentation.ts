import { config } from '../config';
import type { Voucher } from '../types';
import type { RedemptionView } from './redemption';

export interface RedemptionPresentation {
  token: string;
  mode: 'redeem';
  redemptionId: string;
  issuedAt: string;
  expiresAt: string;
  expiresIn: number;
  /** Deliberately unsigned demo data. A live consumer must reject it. */
  demo?: true;
}

export class RedemptionWireError extends Error {
  constructor(field: string) { super(`Invalid redemption response: ${field}`); this.name = 'RedemptionWireError'; }
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const time = (value: unknown): value is string => nonempty(value) && Number.isFinite(Date.parse(value));

export function parseRedemptionView(raw: unknown, expectedId?: string): RedemptionView {
  if (!record(raw) || !nonempty(raw.id) || (expectedId && raw.id !== expectedId)) throw new RedemptionWireError('id');
  if (!Number.isSafeInteger(raw.points) || Number(raw.points) <= 0
    || typeof raw.valueJod !== 'number' || !Number.isFinite(raw.valueJod) || raw.valueJod <= 0) throw new RedemptionWireError('value');
  if (!['pending', 'settled', 'expired', 'cancelled'].includes(String(raw.status)) || !time(raw.expiresAt)
    || !Number.isSafeInteger(raw.expiresIn) || Number(raw.expiresIn) < 0) throw new RedemptionWireError('status');
  for (const key of ['returnedPoints', 'expiredPoints']) {
    if (raw[key] !== null && (!Number.isSafeInteger(raw[key]) || Number(raw[key]) < 0)) throw new RedemptionWireError(key);
  }
  if (typeof raw.refundReviewRequired !== 'boolean') throw new RedemptionWireError('refundReviewRequired');
  return {
    id: raw.id, points: Number(raw.points), valueJod: raw.valueJod,
    status: raw.status as RedemptionView['status'], expiresAt: raw.expiresAt, expiresIn: Number(raw.expiresIn),
    returnedPoints: raw.returnedPoints as number | null, expiredPoints: raw.expiredPoints as number | null,
    recoveredPoints: typeof raw.recoveredPoints === 'number' ? raw.recoveredPoints : 0,
    refundReviewRequired: raw.refundReviewRequired,
  };
}

/** Shape validation is not signature verification. Live tokens only arrive
 * from the authenticated API; the POS verifies their HMAC and exact owner/id. */
export function parseRedemptionPresentation(raw: unknown, expectedId: string, allowDemo = false): RedemptionPresentation {
  if (!record(raw) || raw.mode !== 'redeem' || raw.redemptionId !== expectedId) throw new RedemptionWireError('redemptionId');
  if (!nonempty(raw.token) || raw.token.length > 4096) throw new RedemptionWireError('token');
  if (raw.demo === true) {
    if (!allowDemo || !raw.token.startsWith('ALMOND-DEMO-REDEMPTION:')) throw new RedemptionWireError('demo');
  } else if (raw.demo !== undefined || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(raw.token)) throw new RedemptionWireError('token');
  if (!time(raw.issuedAt) || !time(raw.expiresAt) || !Number.isSafeInteger(raw.expiresIn)
    || Number(raw.expiresIn) <= 0 || Number(raw.expiresIn) > config.REDEMPTION_QR_TTL_SECONDS
    || Date.parse(raw.expiresAt) - Date.parse(raw.issuedAt) !== Number(raw.expiresIn) * 1000) throw new RedemptionWireError('expiry');
  return {
    token: raw.token, mode: 'redeem', redemptionId: expectedId,
    issuedAt: raw.issuedAt, expiresAt: raw.expiresAt, expiresIn: Number(raw.expiresIn),
    ...(raw.demo === true ? { demo: true as const } : {}),
  };
}

export function voucherForRedemption(row: RedemptionView, titles: { titleAr: string; titleEn: string }): Voucher {
  return { id: row.id, redemptionId: row.id, points: row.points, value: row.valueJod,
    type: 'credit', expiresAt: row.expiresAt, used: row.status !== 'pending', ...titles };
}

/** Count from request START, never receipt. Network delay and a slow response
 * cannot visually add time to the server's absolute deadline. A clock ahead
 * fails closed; a clock behind still gets at most the server's lifetime. */
export function redemptionPresentationDeadline(wire: RedemptionPresentation, requestStartedAt: number): number {
  return Math.min(Date.parse(wire.expiresAt), requestStartedAt + wire.expiresIn * 1000);
}
