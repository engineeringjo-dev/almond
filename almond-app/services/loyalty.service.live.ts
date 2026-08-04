import type {
  LoyaltyBalance,
  Voucher,
  PointsLogEntry,
  EarnResult,
  SpinConfig,
  SpinEligibility,
  SpinResult,
  ReferralInfo,
  GiftCard,
  Subscription,
} from '@/types';
import type { LoyaltyService, EarnInput, ScanStatus } from './loyalty.service';
import { integration, loyaltyAuthHeaders } from '@/constants/integration';
import { apiGet, apiPost } from '@/lib/apiClient';

/**
 * Live loyalty / e-wallet / gift / POS client. Talks to the standalone loyalty
 * server (config.LOYALTY_BASE_URL) using the central endpoint map + bearer auth
 * from constants/integration.ts. Inactive until DATA_SOURCE === 'odoo'.
 * Contract: docs/ODOO-INTEGRATION.md.
 */
const BASE = integration.baseUrls.loyalty;
const E = integration.endpoints;
const get = <T>(path: string) => apiGet<T>(BASE, path, loyaltyAuthHeaders());
const post = <T>(path: string, body: unknown) => apiPost<T>(BASE, path, body, loyaltyAuthHeaders());

export const liveLoyaltyService: LoyaltyService = {
  getBalance: (userId) => get<LoyaltyBalance>(E.balance(userId)),
  getVouchers: (userId) => get<Voucher[]>(E.vouchers(userId)),
  redeemReward: (userId, input) =>
    post<{ points: number; voucher: Voucher }>(E.redeemReward, { userId, ...input }),
  earn: (input: EarnInput) => post<EarnResult>(E.earn, input),
  getHistory: (userId) => get<PointsLogEntry[]>(E.history(userId)),

  getSpinConfig: () => get<SpinConfig>(`/loyalty/spin/config`),
  getSpinEligibility: (userId) => get<SpinEligibility>(`/loyalty/spin/eligibility/${userId}`),
  spin: (userId) => post<SpinResult>(`/loyalty/spin`, { userId }),

  // ---- E-wallet ----
  getWallet: (userId) => get<{ balance: number }>(E.wallet(userId)).then((r) => r.balance),
  topUp: (userId, amount) =>
    post<{ balance: number }>(E.walletTopup, { userId, amount }).then((r) => r.balance),
  chargeWallet: (userId, amount) =>
    post<{ walletBalance: number }>(E.walletCharge, { userId, amount }),

  // ---- Gift cards ----
  sendGift: (input) => post<GiftCard>(E.giftSend, input),
  getSentGifts: (userId) => get<GiftCard[]>(E.giftSent(userId)),
  redeemGiftCode: (userId, code) =>
    post<{ amount: number; walletBalance: number }>(E.giftRedeem, { userId, code }),

  // ---- POS scan confirmation ----
  getScanStatus: (userId) => get<ScanStatus>(E.scanStatus(userId)),

  // ---- "Almond Club" subscription ----
  getSubscription: (userId) => get<Subscription>(`/v1/me/subscription?userId=${userId}`),
  subscribe: (_userId, paymentMethod) =>
    post<{ subscription: Subscription; walletBalance: number }>(`/v1/subscription/subscribe`, { paymentMethod }),

  getReferralCode: (userId) => get<ReferralInfo>(`/loyalty/referral/code/${userId}`),
  claimReferral: (referrerId, referredPhone) =>
    post<{ rewarded: boolean }>(`/loyalty/referral/claim`, { referrerId, referredPhone }),
  rateBranch: (input) => post<{ rewarded: boolean }>(`/loyalty/rate-branch`, input),
};
