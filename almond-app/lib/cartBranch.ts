import type { Branch, Lang, OrderType } from '@/types';

/**
 * THE CART'S BRANCH — which one it is, whether checkout may start, and, when
 * it is not the one the customer chose, why not.
 *
 * The cart used to read `branches.find(id === branchId)` and hand the result to
 * <BranchCard branch={branch!}> for a dine-in order. The branch list is a query
 * whose key carries the customer's coordinates, so it is `undefined` on a cold
 * start AND again every time a location fix changes the key: a returning
 * dine-in customer hit the error boundary instead of their cart (audit P0,
 * reproduced on the web export). These functions are the whole decision, so
 * the screen has nothing left to assert non-null.
 *
 * THE SILENT SWITCH (owner, 2026-09-30). When the saved branch had left the
 * list, the cart moved the order to the nearest open branch and said nothing:
 * the customer could drive to «الرابية» for an order placed at «خلدا». Every
 * switch now comes back with its reason and both names, and the cart and the
 * review say it out loud (BranchNotice).
 */

/** What a branch is called — enough to name it after it has left the list. */
export type BranchNames = Pick<Branch, 'nameAr' | 'nameEn'>;
export type BranchRef = Pick<Branch, 'id' | 'nameAr' | 'nameEn'>;

export const branchRef = (b: BranchRef): BranchRef => ({ id: b.id, nameAr: b.nameAr, nameEn: b.nameEn });

/** Why the cart is not on the branch the customer chose. */
export type BranchSwitchReason =
  /** The saved branch is no longer in the list (removed, or not serving the app). */
  | 'unavailable'
  /** The saved branch is listed but closed now, and another one is open. */
  | 'closed';

export interface BranchSwitch {
  reason: BranchSwitchReason;
  /** The branch they had chosen, by name — `null` for a cart saved before
   *  names were kept, whose branch has since left the list. */
  from: BranchNames | null;
  /** Where the order goes now. */
  to: BranchRef;
  /** Whether `to` is open. False only when NOTHING is open: we still name
   *  the nearest one rather than leave the cart without a branch. */
  toOpen: boolean;
}

export interface CartBranchChoice {
  /** The persisted branch id, `null` when the customer never chose one. */
  id: string | null;
  /** Its name as it was when chosen, so a vanished branch can still be named. */
  names?: BranchNames | null;
  /**
   * Chosen in THIS session (a tap in a picker, not a value restored from
   * storage). A closed branch the customer has just picked on purpose is
   * theirs to keep; only a stale one is moved off.
   */
  pinned?: boolean;
}

export interface CartBranch {
  /** `undefined` only while there is no list at all. */
  branch: Branch | undefined;
  /** Set when `branch` is not the one the customer chose — never silently. */
  switched: BranchSwitch | null;
}

/**
 * The branch the cart should show:
 * - no choice yet → the nearest open one (else the nearest), with no notice —
 *   nothing was taken away;
 * - the choice is listed and open (or open-ness unknown) → it;
 * - the choice is listed but CLOSED, restored from an earlier session, and
 *   another branch is open → the nearest open one, reason `closed`;
 *   (picked this session, or nothing is open → kept, its card says «مغلق»);
 * - the choice is gone from the list → the nearest open one (else the
 *   nearest), reason `unavailable`.
 */
export function resolveCartBranch(branches: readonly Branch[], choice: CartBranchChoice): CartBranch {
  if (branches.length === 0) return { branch: undefined, switched: null };
  const nearestOpen = branches.find((b) => b.isOpen);
  const fallback = nearestOpen ?? branches[0];
  if (!choice.id) return { branch: fallback, switched: null };

  const chosen = branches.find((b) => b.id === choice.id);
  if (!chosen) {
    return {
      branch: fallback,
      switched: {
        reason: 'unavailable',
        from: choice.names ? { nameAr: choice.names.nameAr, nameEn: choice.names.nameEn } : null,
        to: branchRef(fallback),
        toOpen: fallback.isOpen === true,
      },
    };
  }
  if (chosen.isOpen !== false || choice.pinned || !nearestOpen) {
    return { branch: chosen, switched: null };
  }
  return {
    branch: nearestOpen,
    switched: { reason: 'closed', from: branchRef(chosen), to: branchRef(nearestOpen), toOpen: true },
  };
}

/** The notice for a switch: which sentence, and the two names in `lang`. */
export function branchSwitchCopy(
  s: BranchSwitch,
  lang: Lang,
): { key: string; params: { from?: string; to: string } } {
  const name = (b: BranchNames) => (lang === 'ar' ? b.nameAr : b.nameEn);
  const to = name(s.to);
  if (s.reason === 'closed' && s.from) {
    return { key: 'cart.branchSwitchClosed', params: { from: name(s.from), to } };
  }
  if (s.from) {
    return s.toOpen
      ? { key: 'cart.branchSwitchGone', params: { from: name(s.from), to } }
      : { key: 'cart.branchSwitchGoneAllClosed', params: { from: name(s.from), to } };
  }
  return s.toOpen
    ? { key: 'cart.branchSwitchGoneUnnamed', params: { to } }
    : { key: 'cart.branchSwitchGoneUnnamedAllClosed', params: { to } };
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
