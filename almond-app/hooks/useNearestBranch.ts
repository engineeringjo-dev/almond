import { useEffect, useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';

import { branchService } from '@/services/branch.service';
import type { Branch } from '@/types';

interface Coord {
  lat: number;
  lng: number;
}

/**
 * Nearest-branch flow (section 7.1): request location → sort by distance →
 * annotate open/closed. Falls back to the full list (manual select) if denied.
 */
export function useNearestBranch() {
  const [coord, setCoord] = useState<Coord | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [locating, setLocating] = useState(true);

  const requestLocation = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        setCoord(null);
        return;
      }
      setPermissionDenied(false);
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoord({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setPermissionDenied(true);
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const query = useQuery({
    queryKey: ['branches', coord?.lat, coord?.lng],
    queryFn: () => branchService.getNearestBranches(coord ?? undefined),
  });

  const branches: Branch[] = query.data ?? [];
  const nearestOpen = branches.find((b) => b.isOpen) ?? branches[0];

  return {
    branches,
    nearest: branches[0],
    nearestOpen,
    coord,
    permissionDenied,
    loading: locating || query.isLoading,
    error: query.isError,
    refetch: query.refetch,
    requestLocation,
  };
}
