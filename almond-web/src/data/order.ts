import type {
  Branch,
  CartItem,
  Order,
  OrderType,
  PaymentMethodId,
} from '@almond/shared/types';
import type { CartTotals } from '@almond/shared/cart';
import { config } from '@/lib/config';

/** Prep time = the slowest item, floored at the default (section 7.3). */
export function estimatePrepMinutes(items: CartItem[]): number {
  return items.reduce<number>(
    (max, l) => Math.max(max, l.prepMinutes ?? 0),
    config.DEFAULT_PREP_MINUTES,
  );
}

/** Beans earned at the base rate (POINTS_PER_JOD); tier multiplier applies later. */
export function estimatedBeans(total: number): number {
  return Math.round(total * config.POINTS_PER_JOD);
}

export interface PlaceOrderInput {
  items: CartItem[];
  totals: CartTotals;
  orderType: OrderType;
  branch: Branch | null;
  paymentMethod: PaymentMethodId;
  paidFromBalance: boolean;
  promoCode: string | null;
  curbside: boolean;
  carInfo: string;
  deliveryAddress?: string;
  deliveryFee?: number;
}

/**
 * Build an order under the mock data source. Under DATA_SOURCE='odoo' this would
 * POST to the orders API and the loyalty earn endpoint instead — same Order shape.
 */
export function createMockOrder(input: PlaceOrderInput): Order {
  const prepMinutes = estimatePrepMinutes(input.items);
  const now = Date.now();
  const id = `order_${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  return {
    id,
    userId: 'guest',
    type: input.orderType,
    branchId: input.branch?.id ?? '',
    branchNameAr: input.branch?.nameAr ?? '',
    branchNameEn: input.branch?.nameEn ?? '',
    items: input.items,
    subtotal: input.totals.subtotal,
    tax: input.totals.tax,
    discount: input.totals.discount,
    total: input.totals.total + (input.deliveryFee ?? 0),
    paymentMethod: input.paymentMethod,
    paidFromBalance: input.paidFromBalance,
    status: 'received',
    createdAt: new Date(now).toISOString(),
    targetReadyAt: new Date(now + prepMinutes * 60000).toISOString(),
    prepMinutes,
    promoCode: input.promoCode ?? undefined,
    curbside: input.curbside || undefined,
    carInfo: input.carInfo || undefined,
    deliveryAddress: input.deliveryAddress || undefined,
  };
}
