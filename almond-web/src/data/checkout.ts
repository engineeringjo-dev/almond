/**
 * THE ORDER OF THINGS AT CHECKOUT — pay, then dispatch, then place.
 *
 * It lives here, not inside CheckoutView, so it can be tested without rendering
 * a page. The component used to run `void payForOrder(order)` — result
 * discarded — then save the order, empty the cart and show success whatever
 * the payment did; and it dispatched the courier BEFORE payment was even
 * attempted. With a real gateway that is an order "placed" and a driver sent
 * for money never collected.
 */
export type SettleResult = { ok: true } | { ok: false; reason: 'payment_failed'; error: unknown };

export interface SettleSteps<O> {
  /** Absent for cash: nothing to capture online. A rejection stops everything. */
  pay?: (order: O) => Promise<unknown>;
  /** Absent for pickup / dine-in. Fire-and-forget: a failed dispatch is
   *  reported, but the (already paid) order still stands. */
  dispatch?: (order: O) => Promise<unknown>;
  onDispatchError?: (error: unknown) => void;
  /** Save the order, empty the cart, go to success. Runs only on success. */
  place: (order: O) => void;
}

export async function settleOrder<O>(order: O, steps: SettleSteps<O>): Promise<SettleResult> {
  if (steps.pay) {
    try {
      await steps.pay(order);
    } catch (error) {
      return { ok: false, reason: 'payment_failed', error };
    }
  }
  if (steps.dispatch) {
    steps.dispatch(order).catch((error: unknown) => steps.onDispatchError?.(error));
  }
  steps.place(order);
  return { ok: true };
}
