import type { Order } from '@almond/shared/types';
import { DATA_SOURCE } from '@/lib/config';
import type {
  DeliveryDispatch,
  DeliveryQuote,
  QuoteParams,
} from '@/lib/delivery-types';

export type { DeliveryDispatch, DeliveryQuote } from '@/lib/delivery-types';

// Mock delivery economics (in-house via Ishbek → Careem/Talabat). Live values
// come from an Ishbek quote via the server route. See docs/DELIVERY-INTEGRATION.md.
export const DELIVERY_FEE = 1.5; // JOD, flat (mock)
export const DELIVERY_ETA = 35; // minutes (mock)

/**
 * Client-side delivery API. It NEVER talks to Ishbek directly and holds no key —
 * it calls our own server routes under /api/delivery, which own the secret. Under
 * mock it short-circuits to local values so the site stays fully demoable.
 */
async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

export async function quoteDelivery(params: QuoteParams = {}): Promise<DeliveryQuote> {
  if (DATA_SOURCE !== 'odoo') return { fee: DELIVERY_FEE, etaMinutes: DELIVERY_ETA };
  return postJSON<DeliveryQuote>('/api/delivery/quote', params);
}

/** Dispatch a captain via our server route (which calls Ishbek with the key). */
export async function dispatchDelivery(order: Order): Promise<DeliveryDispatch> {
  if (DATA_SOURCE !== 'odoo') {
    return { id: `disp_${order.id}`, fleet: 'careem', status: 'assigned', etaMinutes: DELIVERY_ETA };
  }
  return postJSON<DeliveryDispatch>('/api/delivery/dispatch', { order });
}
