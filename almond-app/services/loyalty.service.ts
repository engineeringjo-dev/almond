import type {
  LoyaltyBalance,
  Voucher,
  PointsLogEntry,
  EarnResult,
  SpinConfig,
  SpinEligibility,
  SpinResult,
  ReferralInfo,
} from '@/types';
import { config } from '@/constants/config';
import { mockLoyaltyService } from './loyalty.service.mock';
import { liveLoyaltyService } from './loyalty.service.live';

export interface EarnInput {
  userId: string;
  invoiceAmount: number;
  paidFromBalance: boolean;
  isFriday?: boolean;
  /** Extra multiplier from an activated bonus-bean day (e.g. 2 = double). */
  bonusMultiplier?: number;
}

export interface LoyaltyService {
  getBalance(userId: string): Promise<LoyaltyBalance>;
  getVouchers(userId: string): Promise<Voucher[]>;
  redeem(userId: string, points: number): Promise<{ points: number; walletBalance: number }>;
  /** Spend points directly on an invoice at checkout (§K) — no wallet credit. */
  spendPoints(userId: string, points: number): Promise<{ points: number }>;
  earn(input: EarnInput): Promise<EarnResult>;
  getHistory(userId: string): Promise<PointsLogEntry[]>;

  // Spin (server decides the prize — anti-cheat, section 13.4)
  getSpinConfig(): Promise<SpinConfig>;
  getSpinEligibility(userId: string): Promise<SpinEligibility>;
  spin(userId: string): Promise<SpinResult>;

  // Wallet / stored value (section 2.2 / 11)
  getWallet(userId: string): Promise<number>;
  topUp(userId: string, amount: number): Promise<number>;

  // Growth rewards (section 2.4.1)
  getReferralCode(userId: string): Promise<ReferralInfo>;
  claimReferral(referrerId: string, referredPhone: string): Promise<{ rewarded: boolean }>;
  rateBranch(input: {
    userId: string;
    branchId: string;
    orderId: string;
    rating: number;
    comment?: string;
  }): Promise<{ rewarded: boolean }>;
}

// The app talks to a separate loyalty server (section 8). When DATA_SOURCE is
// not 'mock', the live HTTP client targets config.LOYALTY_BASE_URL.
export const loyaltyService: LoyaltyService =
  config.DATA_SOURCE === 'odoo' ? liveLoyaltyService : mockLoyaltyService;
