/**
 * Server-only Ishbek client (delivery bridge → Careem / Talabat).
 *
 * SECURITY: this module reads `ISHBEK_KEY` / `ISHBEK_WEBHOOK_SECRET` from the
 * server environment and must ONLY be imported by API route handlers. It is
 * never imported by a client component, so the key is never sent to the browser
 * (contrast with the old NEXT_PUBLIC_ISHBEK_KEY, which was bundled client-side).
 */
import crypto from 'node:crypto';
import type { CartItem, Order } from '@almond/shared/types';
import { integration } from '@almond/shared/integration';
import { DATA_SOURCE } from '@/lib/config';
import type {
  CancelParams,
  DeliveryDispatch,
  DeliveryQuote,
  DispatchStatus,
  Fleet,
  QuoteParams,
} from '@/lib/delivery-types';

// Static access → Next keeps these server-side only (undefined in the browser).
const KEY = process.env.ISHBEK_KEY ?? '';
const WEBHOOK_SECRET = process.env.ISHBEK_WEBHOOK_SECRET ?? '';
const BASE = integration.baseUrls.ishbek;

/** Live only when pointed at Odoo AND a key is present; otherwise mock. */
const isLive = (): boolean => DATA_SOURCE === 'odoo' && KEY.length > 0;

async function ishbekFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Ishbek-Key': KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Ishbek ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

/** Flatten a cart line into Ishbek modifiers (size + customizations) with price. */
function toIshbekLine(item: CartItem) {
  const modifiers = [
    { groupId: 'size', optionId: item.sizeId, name: item.sizeNameAr, priceDelta: 0 },
    ...item.customizations.map((c) => ({
      groupId: c.groupId,
      optionId: c.optionId,
      name: c.nameAr,
      priceDelta: c.priceDelta,
    })),
  ];
  const unitPrice =
    item.unitBasePrice + item.customizations.reduce((s, c) => s + c.priceDelta, 0);
  return {
    itemId: item.itemId,
    name: item.nameAr,
    qty: item.qty,
    unitPrice: Number(unitPrice.toFixed(3)),
    modifiers,
  };
}

/**
 * Build the dispatch payload from an order. `createdAt` / `targetReadyAt` already
 * carry the explicit Asia/Amman +03:00 offset (see @almond/shared toAmmanISO),
 * so timing reflects on the POS correctly — never a bare UTC `Z`.
 */
export function buildDispatchPayload(order: Order) {
  return {
    orderId: order.id,
    branch: { id: order.branchId, nameAr: order.branchNameAr },
    // TODO(live): geocode deliveryAddress → { lat, lng } when wiring Ishbek.
    dropoff: { text: order.deliveryAddress ?? '' },
    customer: { id: order.userId },
    timing: {
      placedAt: order.createdAt,
      readyAt: order.targetReadyAt,
      prepMinutes: order.prepMinutes,
      schedulePickup: true,
    },
    lines: order.items.map(toIshbekLine),
  };
}

export async function ishbekQuote(params: QuoteParams): Promise<DeliveryQuote> {
  if (!isLive()) return { fee: 1.5, etaMinutes: 35 };
  const r = await ishbekFetch<{ recommended: { fee: number; etaMinutes: number } }>(
    integration.endpoints.deliveryQuote,
    params,
  );
  return { fee: r.recommended.fee, etaMinutes: r.recommended.etaMinutes };
}

export async function ishbekDispatch(order: Order): Promise<DeliveryDispatch> {
  const payload = buildDispatchPayload(order);
  if (!isLive()) {
    return { id: `disp_${order.id}`, fleet: 'careem', status: 'assigned', etaMinutes: 35 };
  }
  const r = await ishbekFetch<{
    dispatchId: string;
    fleet: Fleet;
    status: DispatchStatus;
    estimatedDropoffMinutes?: number;
  }>(integration.endpoints.deliveryDispatch, payload);
  return {
    id: r.dispatchId,
    fleet: r.fleet,
    status: r.status,
    etaMinutes: r.estimatedDropoffMinutes ?? 35,
  };
}

export async function ishbekCancel(params: CancelParams): Promise<{ status: 'cancelled' }> {
  if (!isLive()) return { status: 'cancelled' };
  await ishbekFetch(integration.endpoints.deliveryCancel, params);
  return { status: 'cancelled' };
}

export async function ishbekStatus(orderId: string): Promise<{ status: DispatchStatus }> {
  if (!isLive()) return { status: 'assigned' };
  const res = await fetch(`${BASE}${integration.endpoints.deliveryStatus(orderId)}`, {
    headers: { 'X-Ishbek-Key': KEY },
  });
  if (!res.ok) throw new Error(`Ishbek status → ${res.status}`);
  return res.json() as Promise<{ status: DispatchStatus }>;
}

/**
 * Verify an inbound webhook's HMAC-SHA256 signature (constant-time). Rejects if
 * no secret is configured or the signature is missing/mismatched.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET || !signature) return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
