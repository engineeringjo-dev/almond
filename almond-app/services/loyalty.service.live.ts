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
import { parseMeBalance, toLoyaltyBalance } from '@almond/shared/loyalty/balanceWire';
import { apiGet, apiPost } from '@/lib/apiClient';

/**
 * Live loyalty / e-wallet / gift / POS client. Talks to the standalone loyalty
 * server (config.LOYALTY_BASE_URL) using the central endpoint map + bearer auth
 * from constants/integration.ts. Inactive until DATA_SOURCE === 'odoo'.
 * Contract: docs/ODOO-INTEGRATION.md.
 *
 * ⚠️ THIS CLIENT IS NOT POINTED AT THE BFF IN THIS REPO, AND CANNOT BE BY
 * CHANGING A URL. A probe booted the real BFF and called all twenty endpoints
 * below with a real member JWT: eighteen returned 404, because this map was
 * written against a hypothetical standalone loyalty server (`/loyalty/*` on
 * config.LOYALTY_BASE_URL) that does not exist, while the BFF registers
 * `/v1/*`. Four independent things are missing, not one:
 *
 *   1. paths — `/loyalty/balance/{userId}` vs `GET /v1/me/balance`;
 *   2. auth — a static build-time EXPO_PUBLIC_LOYALTY_TOKEN plus a userId in
 *      the URL, vs the BFF's per-member JWT whose SUBJECT is the identity.
 *      `stores/authStore.ts` has no token field, so the app never holds one;
 *   3. contracts — e.g. redeemReward posts {beans,titleAr,titleEn,type} where
 *      `POST /v1/loyalty/redeem` takes {points}. Repointing paths alone would
 *      turn 404s into 400s;
 *   4. features — spin, gift cards, referrals, branch ratings and scan-status
 *      have no BFF route at all. They are unbuilt features, not broken wiring.
 *
 * Cutover is therefore an integration project, not a config flip, and it is
 * recorded as such. What HAS been repaired is the one seam that could have gone
 * live silently wrong: `getBalance` now validates and maps the BFF's real wire
 * shape (see @almond/shared/loyalty/balanceWire) instead of casting it. The
 * cast is what let an object-vs-string `tier` mismatch sit unnoticed while it
 * rendered "2%" for members the server pays 6%.
 */
const BASE = integration.baseUrls.loyalty;
const E = integration.endpoints;
const get = <T>(path: string) => apiGet<T>(BASE, path, loyaltyAuthHeaders());
const post = <T>(path: string, body: unknown) => apiPost<T>(BASE, path, body, loyaltyAuthHeaders());

export const liveLoyaltyService: LoyaltyService = {
  // Validated, not cast. `parseMeBalance` throws a named BalanceWireError at
  // the seam if the body is not the contract; the old `get<LoyaltyBalance>(…)`
  // asserted the shape, so every consumer's `tiers.find(t => t.id === tier) ??
  // tiers[0]` fallback silently produced the ENTRY rung for a member on any
  // other one — a wrong cashback rate on four screens and in the cart's earn
  // estimate, with nothing raising an error. `userId` is supplied here because
  // the server never sends it: the member is the JWT subject.
  getBalance: async (userId): Promise<LoyaltyBalance> =>
    toLoyaltyBalance(parseMeBalance(await get<unknown>(E.balance(userId))), userId),
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
