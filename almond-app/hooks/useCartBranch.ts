import { useEffect, useMemo } from 'react';

import { useNearestBranch } from '@/hooks/useNearestBranch';
import { resolveCartBranch } from '@/lib/cartBranch';
import { useCartStore } from '@/stores/cartStore';

/**
 * The branch the order goes to, shared by every surface that names it (the
 * menu's pickup bar and the cart), so they can never name two different ones.
 *
 * When the resolution moves the order off the customer's branch, the move is
 * persisted (the order is placed where it is shown) AND recorded as a notice
 * the cart keeps on screen until the customer dismisses it or picks a branch.
 */
export function useCartBranch() {
  const nearest = useNearestBranch();
  const branchId = useCartStore((s) => s.branchId);
  const branchNames = useCartStore((s) => s.branchNames);
  const pinned = useCartStore((s) => s.branchPinned);
  const notice = useCartStore((s) => s.branchNotice);
  const switchBranch = useCartStore((s) => s.switchBranch);

  const { branch, switched } = useMemo(
    () => resolveCartBranch(nearest.branches, { id: branchId, names: branchNames, pinned }),
    [nearest.branches, branchId, branchNames, pinned],
  );

  useEffect(() => {
    if (switched) switchBranch(switched);
  }, [switched, switchBranch]);

  return { ...nearest, branch, notice };
}
