import type {
  Branch,
  CartItem,
  Order,
  OrderType,
  PaymentMethodId,
} from '@almond/shared/types';
import type { CartTotals } from '@almond/shared/cart';
import { toAmmanISO } from '@almond/shared/lib/format';
import { earnRulesFromConfig, type EarnRules } from '@almond/shared/loyalty/earn';
import { config } from '@/lib/config';

/** Prep time = the slowest item, floored at the default (section 7.3). */
export function estimatePrepMinutes(items: CartItem[]): number {
  return items.reduce<number>(
    (max, l) => Math.max(max, l.prepMinutes ?? 0),
    config.DEFAULT_PREP_MINUTES,
  );
}

// `estimatedBeans` is deleted: the earn arithmetic lives only in
// packages/shared/src/loyalty/earn.ts. Callers use `earnedPoints({ total,
// comboPairs })` — see docs/LOYALTY-EARN-PATCH.md §3.5 row 6.

/**
 * Rules for the beans figure the site DISPLAYS at checkout. Identical to the
 * compiled config except `weekdayBonus: []`, which keeps Friday out of the
 * displayed number exactly as it is today. Showing it is the marketing decision
 * held in docs/LOYALTY-EARN-PATCH.md §8.9; drop the override to ship it.
 *
 * The `: EarnRules` annotation is load-bearing, not decoration: without a
 * contextual type there is no excess-property check, so a misspelled override
 * key would compile clean, the spread would supply the real `weekdayBonus`, and
 * §8.9's Friday bonus would silently start appearing in the displayed number.
 */
export const DISPLAY_EARN_RULES: EarnRules = { ...earnRulesFromConfig(), weekdayBonus: [] };

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
    createdAt: toAmmanISO(now),
    targetReadyAt: toAmmanISO(now + prepMinutes * 60000),
    prepMinutes,
    promoCode: input.promoCode ?? undefined,
    curbside: input.curbside || undefined,
    carInfo: input.carInfo || undefined,
    deliveryAddress: input.deliveryAddress || undefined,
  };
}
