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
} from '@/types';
import type { LoyaltyService, EarnInput } from './loyalty.service';
import { config } from '@/constants/config';

/**
 * Live loyalty client — talks to the separate Node.js loyalty server
 * (section 8) at config.LOYALTY_BASE_URL. Endpoint paths match section 8.1.
 */
const BASE = config.LOYALTY_BASE_URL;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Loyalty GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Loyalty POST ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const liveLoyaltyService: LoyaltyService = {
  getBalance: (userId) => get<LoyaltyBalance>(`/loyalty/balance/${userId}`),
  getVouchers: (userId) => get<Voucher[]>(`/loyalty/vouchers/${userId}`),
  redeemReward: (userId, input) =>
    post<{ points: number; voucher: Voucher }>(`/loyalty/redeem-reward`, { userId, ...input }),
  earn: (input: EarnInput) => post<EarnResult>(`/loyalty/earn`, input),
  getHistory: (userId) => get<PointsLogEntry[]>(`/loyalty/history/${userId}`),

  getSpinConfig: () => get<SpinConfig>(`/loyalty/spin/config`),
  getSpinEligibility: (userId) => get<SpinEligibility>(`/loyalty/spin/eligibility/${userId}`),
  spin: (userId) => post<SpinResult>(`/loyalty/spin`, { userId }),

  // TODO: confirm loyalty-server wallet endpoints.
  getWallet: (userId) => get<{ balance: number }>(`/loyalty/wallet/${userId}`).then((r) => r.balance),
  topUp: (userId, amount) =>
    post<{ balance: number }>(`/loyalty/wallet/topup`, { userId, amount }).then((r) => r.balance),

  // TODO: confirm gift-card endpoints on the loyalty server.
  sendGift: (input) => post<GiftCard>(`/loyalty/gifts/send`, input),
  getSentGifts: (userId) => get<GiftCard[]>(`/loyalty/gifts/sent/${userId}`),
  redeemGiftCode: (userId, code) =>
    post<{ amount: number; walletBalance: number }>(`/loyalty/gifts/redeem`, { userId, code }),

  getReferralCode: (userId) => get<ReferralInfo>(`/loyalty/referral/code/${userId}`),
  claimReferral: (referrerId, referredPhone) =>
    post<{ rewarded: boolean }>(`/loyalty/referral/claim`, { referrerId, referredPhone }),
  rateBranch: (input) => post<{ rewarded: boolean }>(`/loyalty/rate-branch`, input),
};
