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
  PaymentMethodId,
} from '@/types';
import type { PosMode, PosTokenWire } from '@almond/shared/pos/tokenWire';
import { config } from '@/constants/config';
import { mockLoyaltyService } from './loyalty.service.mock';
import { liveLoyaltyService } from './loyalty.service.live';

export interface EarnInput {
  userId: string;
  /** Tax-INCLUSIVE invoice total, i.e. computeTotals(...).total. See §1.1. */
  invoiceAmount: number;
  paidFromBalance: boolean;
  /**
   * WHOLE POINTS spent against this invoice — the redeem that made the bill
   * cheaper or free. Absent means zero.
   *
   * Points are money (owner, 2026-09-08) and «لا يكسب نقاط على الجزء المدفوع
   * بالنقاط»: the part of the bill paid with points earns nothing. POINTS, not
   * JOD — the conversion is the shared earn function's business (its
   * `pointsPerJodRedeem`), exactly like the points per pair below, so the phone
   * cannot convert at one rate while the server charges at another.
   */
  pointsRedeemed?: number;
  /** Drink+food pairs from comboPairs(items). The POINTS per pair are the
   *  shared earn function's business, never the caller's. */
  comboPairs?: number;
  /** True only when the member activated today's bonus day. */
  bonusDayActivated?: boolean;
  /** Decision clock (tests / deterministic estimates). */
  at?: Date;
}

export interface SendGiftInput {
  senderId: string;
  designId: string;
  amount: number;
  recipientName: string;
  recipientPhone?: string;
  message?: string;
}

/**
 * The code the member shows at the till, exactly as the server minted it.
 *
 * The app cannot build one: it is signed with a secret only the BFF holds, it
 * expires (config.POS_TOKEN_TTL_SECONDS), and it is burned on first scan. The
 * screen that renders it obtains it HERE and nowhere else — there is no
 * fallback format, because the fallback WAS the defect (a static
 * `MEMBER|<userId>|MODE=…` string that anyone who learned a member id could
 * render and anyone with a photograph could replay).
 */
export type { PosMode, PosTokenWire } from '@almond/shared/pos/tokenWire';

/** POS scan confirmation polled by the barcode screen (Odoo POS → server). */
export interface ScanStatus {
  scanned: boolean;
  /** Earn result the till reported, if any (beans earned + cup). */
  result?: EarnResult;
}

/**
 * Redeeming points — issues a voucher the member shows at the till.
 *
 * 🔴 `'credit'` IS NOW THE ONLY TYPE THE APP MINTS, and that is the whole
 * change. The union used to be `'free-item' | 'discount'` with the comment
 * "no cash value", because a redemption used to be a named thing off a board
 * capped at a value. Owner, 2026-09-08: «رح اعامل النقاط كنقود ... فهي تقلل
 * الفاتورة او تعملها مجانية». Points are money; a redemption is money off the
 * bill. `'free-item'` and `'discount'` stay in the union only because
 * Voucher.type carries them for vouchers minted elsewhere (the second-visit
 * free drink is a real free item), not because this call should produce one.
 */
export interface RedeemRewardInput {
  beans: number;
  titleAr: string;
  titleEn: string;
  type: 'credit' | 'free-item' | 'discount';
  /** What the voucher is worth in JOD. Under `'credit'` this is EXACT, not a
   *  cap: jodFromPoints(beans), computed by the caller from the points it is
   *  actually spending. */
  value?: number;
}

export interface LoyaltyService {
  getBalance(userId: string): Promise<LoyaltyBalance>;
  getVouchers(userId: string): Promise<Voucher[]>;
  /**
   * Redeem points → issues a credit voucher worth jodFromPoints(beans), which
   * the member shows at the till to reduce (or clear) their bill.
   *
   * It does NOT move money into the wallet. The wallet is prepaid cash the
   * member topped up with; points are a discount the house grants. Crediting
   * one from the other would make points refundable, which they are not.
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

  /**
   * Mint the code the member shows at the till. Called on the Pay screen and by
   * nothing else.
   *
   * `mode` is the member's stated intent (pay with the wallet vs earn only). It
   * is a parameter of the REQUEST — not something the client writes into the
   * code — so the server can sign it into the token and `POST /v1/pos/scan` can
   * hand it to the till alongside the member id. That is the whole reason it
   * travels here: after this change the barcode is opaque, so a mode the token
   * does not carry cannot reach the counter at all.
   *
   * Never returns a locally-constructed value, in ANY data source. The mock
   * returns an obviously unsigned token of the same shape; it does not return
   * the retired static string, and @almond/shared/pos/tokenWire refuses that
   * format at the seam even if something upstream tries.
   */
  getPosToken(userId: string, mode: PosMode): Promise<PosTokenWire>;

  // POS integration: app polls after showing the barcode; the till reports the
  // scan + earn/redeem/charge it performed (Odoo POS → loyalty server).
  getScanStatus(userId: string): Promise<ScanStatus>;

  // "Almond Club" monthly subscription
  getSubscription(userId: string): Promise<Subscription>;
  subscribe(userId: string, paymentMethod: PaymentMethodId): Promise<{ subscription: Subscription; walletBalance: number }>;

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
