import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { loyaltyService } from '@/services/loyalty.service';
import { useUserId } from '@/stores/authStore';

export function useLoyaltyBalance() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['loyalty', 'balance', userId],
    queryFn: () => loyaltyService.getBalance(userId),
  });
}

export function useVouchers() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['loyalty', 'vouchers', userId],
    queryFn: () => loyaltyService.getVouchers(userId),
  });
}

export function usePointsHistory() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['loyalty', 'history', userId],
    queryFn: () => loyaltyService.getHistory(userId),
  });
}

export function useWallet() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['loyalty', 'wallet', userId],
    queryFn: () => loyaltyService.getWallet(userId),
  });
}

export function useSpinConfig() {
  return useQuery({
    queryKey: ['loyalty', 'spin', 'config'],
    queryFn: () => loyaltyService.getSpinConfig(),
  });
}

export function useSpinEligibility() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['loyalty', 'spin', 'eligibility', userId],
    queryFn: () => loyaltyService.getSpinEligibility(userId),
  });
}

/** Invalidate all loyalty queries (after earn/spin/redeem/topup). */
export function useInvalidateLoyalty() {
  const qc = useQueryClient();
  const userId = useUserId();
  return () => {
    qc.invalidateQueries({ queryKey: ['loyalty'] });
    return userId;
  };
}

export function useRedeem() {
  const userId = useUserId();
  const invalidate = useInvalidateLoyalty();
  return useMutation({
    mutationFn: (points: number) => loyaltyService.redeem(userId, points),
    onSuccess: invalidate,
  });
}

export function useTopUp() {
  const userId = useUserId();
  const invalidate = useInvalidateLoyalty();
  return useMutation({
    mutationFn: (amount: number) => loyaltyService.topUp(userId, amount),
    onSuccess: invalidate,
  });
}
