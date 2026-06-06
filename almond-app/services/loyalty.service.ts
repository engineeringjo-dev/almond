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
  /** Flat bonus points for drink+food combos in the order (see lib/combo.ts). */
  comboBonusPoints?: number;
}

export interface SendGiftInput {
  senderId: string;
  designId: string;
  amount: number;
  recipientName: string;
  recipientPhone?: string;
  message?: string;
}

/** POS scan confirmation polled by the barcode screen (Odoo POS → server). */
export interface ScanStatus {
  scanned: boolean;
  /** Earn result the till reported, if any (beans earned + cup). */
  result?: EarnResult;
}

/** Redeeming beans for a catalog Reward — issues a voucher (no cash value). */
export interface RedeemRewardInput {
  beans: number;
  titleAr: string;
  titleEn: string;
  type: 'free-item' | 'discount';
  /** Reference value in JOD (for discount vouchers / display). */
  value?: number;
}

export interface LoyaltyService {
  getBalance(userId: string): Promise<LoyaltyBalance>;
  getVouchers(userId: string): Promise<Voucher[]>;
  /**
   * Redeem beans for a catalog Reward → issues a voucher. Beans have NO cash
   * value and are never converted to wallet money (Starbucks model).
   */
  redeemReward(userId: string, input: RedeemRewardInput): Promise<{ points: number; voucher: Voucher }>;
  earn(input: EarnInput): Promise<EarnResult>;
  getHistory(userId: string): Promise<PointsLogEntry[]>;

  // Spin (server decides the prize — anti-cheat, section 13.4)
  getSpinConfig(): Promise<SpinConfig>;
  getSpinEligibility(userId: string): Promise<SpinEligibility>;
  spin(userId: string): Promise<SpinResult>;

  // Wallet / stored value (section 2.2 / 11)
  getWallet(userId: string): Promise<number>;
  topUp(userId: string, amount: number): Promise<number>;
  /** Deduct from the e-wallet (in-app wallet payment or POS charge). */
  chargeWallet(userId: string, amount: number): Promise<{ walletBalance: number }>;

  // POS integration: app polls after showing the barcode; the till reports the
  // scan + earn/redeem/charge it performed (Odoo POS → loyalty server).
  getScanStatus(userId: string): Promise<ScanStatus>;

  // Gift cards / eGifts — feed the wallet (Wallet spec §1.1 "gift" source)
  sendGift(input: SendGiftInput): Promise<GiftCard>;
  getSentGifts(userId: string): Promise<GiftCard[]>;
  /** Redeem a gift code → adds its amount to the wallet (no reload bonus). */
  redeemGiftCode(userId: string, code: string): Promise<{ amount: number; walletBalance: number }>;

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
