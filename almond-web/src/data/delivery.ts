import type { Order } from '@almond/shared/types';
import { DATA_SOURCE } from '@/lib/config';

// Mock delivery economics (in-house via Ishbek → Careem/Talabat). Live values
// come from an Ishbek quote. See docs/DELIVERY-INTEGRATION.md.
export const DELIVERY_FEE = 1.5; // JOD, flat (mock)
export const DELIVERY_ETA = 35; // minutes (mock)

export interface DeliveryDispatch {
  id: string;
  fleet: 'careem' | 'talabat';
  status: 'assigned' | 'picked_up' | 'delivered';
  etaMinutes: number;
}

const notWired = () =>
  new Error('Ishbek delivery is not wired yet — run with NEXT_PUBLIC_DATA_SOURCE=mock.');

export async function quoteDelivery(): Promise<{ fee: number; etaMinutes: number }> {
  if (DATA_SOURCE === 'odoo') throw notWired();
  return { fee: DELIVERY_FEE, etaMinutes: DELIVERY_ETA };
}

/** Dispatch a captain. Mock returns an assignment; Odoo→Ishbek does it live. */
export async function dispatchDelivery(order: Order): Promise<DeliveryDispatch> {
  if (DATA_SOURCE === 'odoo') throw notWired();
  return { id: `disp_${order.id}`, fleet: 'careem', status: 'assigned', etaMinutes: DELIVERY_ETA };
}
