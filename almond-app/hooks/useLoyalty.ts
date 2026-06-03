import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { loyaltyService, type RedeemRewardInput } from '@/services/loyalty.service';
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

/** Invalidate all loyalty queries (after earn/redeem/topup). */
export function useInvalidateLoyalty() {
  const qc = useQueryClient();
  const userId = useUserId();
  return () => {
    qc.invalidateQueries({ queryKey: ['loyalty'] });
    return userId;
  };
}

/** Redeem beans for a catalog Reward (issues a voucher; no cash value). */
export function useRedeemReward() {
  const userId = useUserId();
  const invalidate = useInvalidateLoyalty();
  return useMutation({
    mutationFn: (input: RedeemRewardInput) => loyaltyService.redeemReward(userId, input),
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
