import type { Branch, OrderType } from '@/types';

/**
 * THE CART'S BRANCH — which one it is, and whether checkout may start.
 *
 * The cart used to read `branches.find(id === branchId)` and hand the result to
 * <BranchCard branch={branch!}> for a dine-in order. The branch list is a query
 * whose key carries the customer's coordinates, so it is `undefined` on a cold
 * start AND again every time a location fix changes the key: a returning
 * dine-in customer hit the error boundary instead of their cart (audit P0,
 * reproduced on the web export). These two functions are the whole decision,
 * so the screen has nothing left to assert non-null.
 */

/**
 * The branch the cart should show: the one the customer chose, while it is
 * still in the list; otherwise the nearest open one; otherwise the nearest.
 * `undefined` only while there is no list at all.
 */
export function resolveCartBranch(
  branches: readonly Branch[],
  selectedId: string | null,
): Branch | undefined {
  const selected = selectedId ? branches.find((b) => b.id === selectedId) : undefined;
  return selected ?? branches.find((b) => b.isOpen) ?? branches[0];
}

/** Why «مراجعة الطلب» cannot start yet — each one is said on screen. */
export type CheckoutBlock = 'branchLoading' | 'branchError' | 'branchMissing';

/**
 * `null` when the review may open. Delivery never reaches the review (it hands
 * off to the aggregator), so it is never blocked here.
 */
export function checkoutBlock(input: {
  orderType: OrderType;
  branch: Branch | undefined;
  loading: boolean;
  error: boolean;
}): CheckoutBlock | null {
  if (input.orderType === 'delivery' || input.branch) return null;
  if (input.loading) return 'branchLoading';
  if (input.error) return 'branchError';
  return 'branchMissing';
}
