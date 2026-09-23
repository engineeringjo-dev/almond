import { createHash } from 'node:crypto';
import { conflict, paymentRequired } from '../http-error';
import type { CheckoutLine, CheckoutPayment, PaymentIntent } from '../backend/types';

/**
 * The rules a payment intent obeys in BOTH stores — written once, so the
 * in-memory and Postgres backends cannot disagree about when a card payment
 * may fund an order.
 */

export const paymentNotCaptured = (why: string) =>
  paymentRequired('payment_not_captured', `the card payment for this order is not confirmed: ${why}`);
export const paymentIntentUsed = () =>
  conflict('payment_intent_used', 'this payment has already paid for another order');

/** The basket an intent is bound to — exactly what /v1/checkout re-prices. */
export interface CartIdentity {
  branchId: string;
  orderType: string;
  lines: CheckoutLine[];
}

/**
 * A stable hash of one basket. Lines keep their order (a reordered cart is the
 * same money, but binding to the exact request is simpler to reason about than
 * a normal form, and the app sends one cart in one order); option ids are
 * sorted, since they are a set. The payment method is NOT in it: the gateway
 * decides whether the card was Visa or Mastercard, not the cart.
 */
export function cartHash(cart: CartIdentity): string {
  const canonical = JSON.stringify({
    b: cart.branchId,
    t: cart.orderType,
    l: cart.lines.map((l) => [l.itemId, l.sizeId, [...(l.optionIds ?? [])].sort(), l.qty]),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * May `intent` pay for this member's order of `payment.amountFils`, for this
 * basket, now? Throws 402 `payment_not_captured` or 409 `payment_intent_used`.
 *
 * The route has already asked the PROVIDER (the authority on whether money
 * moved). This is what the DATABASE knows, checked under the row lock inside
 * Backend.checkout: the intent is this member's, for this amount and this
 * basket, not declined, and not already spent on another order.
 */
export function assertIntentSpendable(
  intent: PaymentIntent | null | undefined,
  memberId: string,
  payment: CheckoutPayment,
): asserts intent is PaymentIntent {
  // One answer for "no such intent" and "someone else's": a member must not be
  // able to probe which intent ids exist.
  if (!intent || intent.memberId !== memberId) throw paymentNotCaptured('no such payment for this member');
  if (intent.orderId !== null) throw paymentIntentUsed();
  if (intent.status === 'failed') throw paymentNotCaptured('the payment was declined');
  if (intent.amountFils !== payment.amountFils) throw paymentNotCaptured('the payment was for a different amount');
  if (intent.cartHash !== payment.cartHash) throw paymentNotCaptured('the payment was for a different basket');
}

/**
 * The status a verified webhook moves an intent to. Monotone towards
 * `captured`: a capture is never undone by a later event (a refund is a
 * separate flow), a spent intent is never touched, and a decline can be
 * followed by a capture when the gateway let the member retry the card.
 */
export function nextIntentStatus(
  intent: Pick<PaymentIntent, 'status' | 'orderId'>,
  reported: 'captured' | 'failed',
): PaymentIntent['status'] {
  if (intent.orderId !== null || intent.status === 'captured') return intent.status;
  return reported;
}
