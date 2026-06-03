import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { loyaltyService, type RedeemRewardInput, type SendGiftInput } from '@/services/loyalty.service';
import { integration } from '@/constants/integration';
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

// ---------- Gift cards (eGifts) ----------

export function useSentGifts() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['gifts', 'sent', userId],
    queryFn: () => loyaltyService.getSentGifts(userId),
  });
}

export function useSendGift() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<SendGiftInput, 'senderId'>) =>
      loyaltyService.sendGift({ ...input, senderId: userId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gifts'] }),
  });
}

export function useRedeemGift() {
  const userId = useUserId();
  const invalidate = useInvalidateLoyalty();
  return useMutation({
    mutationFn: (code: string) => loyaltyService.redeemGiftCode(userId, code),
    onSuccess: invalidate,
  });
}

/** Deduct from the e-wallet (in-app wallet payment / Odoo POS charge). */
export function useChargeWallet() {
  const userId = useUserId();
  const invalidate = useInvalidateLoyalty();
  return useMutation({
    mutationFn: (amount: number) => loyaltyService.chargeWallet(userId, amount),
    onSuccess: invalidate,
  });
}

/**
 * POS scan-status poll for the barcode screen. Inactive under mock — only polls
 * when the POS integration is enabled (constants/integration.ts).
 */
export function useScanStatus() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['loyalty', 'scan', userId],
    queryFn: () => loyaltyService.getScanStatus(userId),
    enabled: integration.enabled.pos,
    refetchInterval: integration.enabled.pos ? 3000 : false,
  });
}
