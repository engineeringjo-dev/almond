import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { loyaltyService, type RedeemRewardInput, type SendGiftInput } from '@/services/loyalty.service';
import { integration } from '@/constants/integration';
import { posQrRefreshMs } from '@/lib/posQr';
import { useUserId } from '@/stores/authStore';
import type { PosMode } from '@almond/shared/pos/tokenWire';
import type { PaymentMethodId } from '@/types';

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

// ---------- "Almond Club" subscription ----------

export function useSubscription() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['loyalty', 'subscription', userId],
    queryFn: () => loyaltyService.getSubscription(userId),
  });
}

export function useSubscribe() {
  const userId = useUserId();
  const invalidate = useInvalidateLoyalty();
  return useMutation({
    mutationFn: (paymentMethod: PaymentMethodId) => loyaltyService.subscribe(userId, paymentMethod),
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
 * The code the member shows at the till.
 *
 * THREE PROPERTIES, and each one is a line of this hook:
 *
 *  1. IT COMES FROM THE SERVER. `queryFn` is the only producer; there is no
 *     initialData, no placeholderData and no catch-and-substitute. If the
 *     request fails there is no code, and the screen says so — see
 *     lib/posQr.ts. A locally-built barcode is the defect this replaces.
 *
 *  2. IT REFRESHES BEFORE IT DIES. `refetchInterval` is derived from the
 *     `expiresIn` the SERVER sent (posQrRefreshMs = half of it), never from a
 *     constant in the app, so raising the TTL by env var on the BFF does not
 *     need an app release.
 *
 *  3. IT STOPS WHEN THE SCREEN IS NOT FOCUSED. `enabled` and the interval both
 *     read `focused`, which the Pay screen drives from useFocusEffect — the
 *     same pattern the brightness override already uses. A member who opens Pay
 *     and walks away is not minting a token a minute, forever, in their pocket:
 *     the tab is one of five and the screen is the app's most-visited, so an
 *     unbounded timer here is a self-inflicted load generator (the same reason
 *     useScanStatus below is bounded).
 *
 * `staleTime: 0` and `gcTime: 0` are deliberate too. A POS token is single-use
 * and wall-clock-bound: serving one from cache on the next focus would show a
 * code that a previous scan may already have burned.
 */
export function usePosToken(opts: { mode: PosMode; focused: boolean }) {
  const userId = useUserId();
  const { mode, focused } = opts;
  return useQuery({
    // The mode is part of the KEY, not just the request: the server signs it
    // into the token, so a token minted for 'pay' is the wrong code to show
    // under an 'earn' label. Switching the toggle asks for a new one.
    queryKey: ['loyalty', 'posToken', userId, mode],
    queryFn: () => loyaltyService.getPosToken(userId, mode),
    enabled: focused,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: (query) => {
      if (!focused) return false;
      const data = query.state.data;
      return data ? posQrRefreshMs(data.expiresIn) : false;
    },
    // The member is standing at a counter: fail fast and show them the panel
    // that tells them what to do, rather than spinning through a retry ladder.
    retry: 1,
  });
}

/** How often to poll the till for a scan, and when to give up (see below). */
const SCAN_POLL_MS = 5000;
const SCAN_POLL_MAX = 24; // stop after ~2 min; the member re-opens Pay to retry

/**
 * POS scan-status poll for the barcode screen. Inactive under mock — only polls
 * when the POS integration is enabled (constants/integration.ts).
 *
 * The poll is bounded on purpose: it stops the moment the till confirms the scan
 * and, failing that, after SCAN_POLL_MAX attempts. An unbounded 3s poll left open
 * on the Pay screen would hammer the loyalty server once DATA_SOURCE flips to
 * 'odoo' (one member on the screen ≈ 1,200 requests/hour), so keep this bounded.
 */
export function useScanStatus() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['loyalty', 'scan', userId],
    queryFn: () => loyaltyService.getScanStatus(userId),
    enabled: integration.enabled.pos,
    refetchInterval: (query) => {
      if (!integration.enabled.pos) return false;
      if (query.state.data?.scanned) return false; // scanned — nothing left to poll
      if (query.state.dataUpdateCount >= SCAN_POLL_MAX) return false; // give up
      return SCAN_POLL_MS;
    },
  });
}
