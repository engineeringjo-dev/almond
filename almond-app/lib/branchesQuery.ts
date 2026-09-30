import { keepPreviousData } from '@tanstack/react-query';

import { branchService } from '@/services/branch.service';

export interface Coord {
  lat: number;
  lng: number;
}

/**
 * The nearest-branches query. Its key carries the coordinates, so every
 * location fix is a NEW query whose data starts `undefined` — and the cart
 * crashed on exactly that gap (audit P0). `keepPreviousData` keeps the list
 * already on screen until the re-sorted one arrives, instead of blanking it on
 * every fix.
 */
export function branchesQuery(coord: Coord | null) {
  return {
    queryKey: ['branches', coord?.lat, coord?.lng] as const,
    queryFn: () => branchService.getNearestBranches(coord ?? undefined),
    placeholderData: keepPreviousData,
  };
}
