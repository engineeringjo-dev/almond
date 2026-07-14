import type { Order } from '@almond/shared/types';
import { DATA_SOURCE } from '@/lib/config';

export interface PaymentResult {
  id: string;
  status: 'paid' | 'pending';
}

/**
 * Secure payment seam. Mock approves instantly. Live creates a payment intent
 * server-side and hands off to a PCI gateway (hosted fields / redirect) — no
 * card data ever touches almond-web. See docs/AUTH-AND-PAYMENTS.md.
 */
export async function payForOrder(order: Order): Promise<PaymentResult> {
  if (DATA_SOURCE === 'odoo') {
    throw new Error('Payment gateway is not wired yet — run with NEXT_PUBLIC_DATA_SOURCE=mock.');
  }
  return { id: `pay_${order.id}`, status: 'paid' };
}
