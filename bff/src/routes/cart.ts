import { z } from 'zod';
import { corporateDiscountAmount, type CorporateEntitlement } from '@almond/shared/loyalty/corporate';
import { reprice } from '../pricing';
import type { Backend } from '../backend';
import type { CheckoutLine } from '../backend/types';

/**
 * THE CART, AS A MEMBER SENDS IT — shared by POST /v1/checkout and
 * POST /v1/payments/intent, so the basket a payment is taken for and the basket
 * the order is placed for are validated by ONE schema and priced by ONE path.
 */
export const cartBodySchema = z.object({
  // Bounded: the branch id is copied into every order line the forecasting
  // store keeps, and an unbounded string there is a megabyte per request.
  branchId: z.string().min(1).max(64),
  orderType: z.enum(['pickup', 'dinein', 'delivery']),
  paymentMethod: z.enum(['cash', 'cliq', 'visa', 'mastercard', 'paypal', 'wallet']),
  lines: z.array(z.object({
    itemId: z.string(),
    sizeId: z.enum(['S', 'M', 'L']),
    optionIds: z.array(z.string()).default([]),
    qty: z.number().int().positive().max(1000),
  })).min(1).max(500),
});

/**
 * Methods whose money is taken by a card gateway. An order naming one of these
 * is placed ONLY against a captured payment intent — never on the client's word
 * that it paid (plugins/funding.ts; owner, 2026-09-23: «اوافق النقاط بعد تاكيد
 * الدفع»).
 *
 * PayPal is here too: it is an online payment captured nowhere in this BFF,
 * exactly like a card, and leaving it out would leave the same hole open under
 * another name.
 */
export const GATEWAY_METHODS: ReadonlySet<string> = new Set(['visa', 'mastercard', 'cliq', 'paypal']);

/**
 * The authoritative re-price, with the member's standing corporate discount
 * resolved from their STORED phone (never from the request). One function, so
 * the intent and the checkout cannot price the same basket differently.
 */
export async function priceCartForMember(backend: Backend, memberId: string, lines: CheckoutLine[]): Promise<
  ReturnType<typeof reprice> & { entitlement: CorporateEntitlement | null }
> {
  const entitlement = await backend.entitlementFor(memberId);
  return {
    ...reprice(
      lines,
      entitlement ? (subtotal) => corporateDiscountAmount(subtotal, entitlement.percentOff) : undefined,
    ),
    entitlement,
  };
}
