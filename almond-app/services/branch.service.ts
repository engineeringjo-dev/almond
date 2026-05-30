import type { Branch } from '@/types';
import { config } from '@/constants/config';
import { branches } from './seed';
import { delay, haversineKm, isBranchOpen } from './util';

export interface BranchService {
  getBranches(): Promise<Branch[]>;
  /** Branches sorted by distance from a coordinate, annotated with open status. */
  getNearestBranches(coord?: { lat: number; lng: number }): Promise<Branch[]>;
  getBranch(id: string): Promise<Branch | undefined>;
}

function annotate(list: Branch[], coord?: { lat: number; lng: number }): Branch[] {
  const annotated = list.map((b) => ({
    ...b,
    isOpen: isBranchOpen(b.hours),
    distanceKm: coord ? haversineKm(coord, b) : undefined,
  }));
  if (coord) {
    annotated.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }
  return annotated;
}

const mockBranchService: BranchService = {
  getBranches: () => delay(annotate(branches)),
  getNearestBranches: (coord) => delay(annotate(branches, coord)),
  getBranch: (id) => delay(annotate(branches).find((b) => b.id === id)),
};

// odoo branches would come from res.partner / a custom model.
const odooBranchService: BranchService = {
  // TODO: confirm Odoo endpoint for branch list.
  getBranches: mockBranchService.getBranches,
  getNearestBranches: mockBranchService.getNearestBranches,
  getBranch: mockBranchService.getBranch,
};

export const branchService: BranchService =
  config.DATA_SOURCE === 'odoo' ? odooBranchService : mockBranchService;
