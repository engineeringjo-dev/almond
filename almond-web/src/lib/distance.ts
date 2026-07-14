import type { Branch } from '@almond/shared/types';

export interface Coords {
  lat: number;
  lng: number;
}

/** Great-circle distance in km (haversine) — same approach as the app. */
export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface BranchDistance {
  branch: Branch;
  distanceKm?: number;
}

/** Attach distances (if coords known) and sort nearest-first. */
export function withDistances(branches: Branch[], coords: Coords | null): BranchDistance[] {
  const list = branches.map((branch) => ({
    branch,
    distanceKm: coords ? haversineKm(coords, branch) : undefined,
  }));
  if (coords) list.sort((x, y) => (x.distanceKm ?? Infinity) - (y.distanceKm ?? Infinity));
  return list;
}
