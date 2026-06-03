import type {
  LoyaltyBalance,
  Voucher,
  PointsLogEntry,
  EarnResult,
  SpinConfig,
  SpinEligibility,
  SpinResult,
  ReferralInfo,
  CupState,
} from '@/types';
import type { GiftCard } from '@/types';
import type { LoyaltyService, EarnInput } from './loyalty.service';
import { config } from '@/constants/config';
import { tierFromSpend } from './seed';
import { delay, genId } from './util';
import { defaultSpinConfig, pickWeightedPrize } from './spinDefaults';
import { reloadBonusBeans } from '@/lib/walletBonus';

interface SpendEntry {
  amount: number;
  at: number; // epoch ms
}

interface LoyaltyUser {
  points: number;
  /** Every qualifying purchase with its timestamp → rolling-12m tier (§A). */
  spendLog: SpendEntry[];
  cup: CupState;
  walletBalance: number;
  vouchers: Voucher[];
  history: PointsLogEntry[];
  visits: number;
  /** Epoch ms of the last bean-earning activity (drives gentle expiry). */
  lastEarnAt: number;
  spinsAvailable: number;
  hasRatedBranchEver: boolean;
  hasReferralRewardEver: boolean;
  referralCode: string;
  phone: string;
}

const ROLLING_WINDOW_MS = 365 * 86400000;

/** Sum of qualifying spend within the last 365 days (Revision Pack §A). */
function rolling12mSpend(u: LoyaltyUser, now = Date.now()): number {
  return u.spendLog
    .filter((e) => e.at >= now - ROLLING_WINDOW_MS)
    .reduce((s, e) => s + e.amount, 0);
}

const store = new Map<string, LoyaltyUser>();
// eGift cards keyed by code. Seeded with one demo code so redeem works out of
// the box (TODO: real gift issuance + delivery + payment on the server).
const gifts = new Map<string, GiftCard>();
let giftsSeeded = false;
function seedGifts() {
  if (giftsSeeded) return;
  giftsSeeded = true;
  gifts.set('ALM-GIFT-2026', {
    id: genId('gift'), code: 'ALM-GIFT-2026', designId: 'anytime-treat', amount: 5,
    recipientName: '', senderId: 'demo', createdAt: new Date().toISOString(), redeemed: false,
  });
}

function genGiftCode(): string {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ALM-${part()}-${part()}`;
}
// Track every phone the system has seen (anti-abuse for referrals, section 8.1.1).
const knownPhones = new Set<string>();
// Spin config (mirrors what the admin panel would push to the loyalty server).
let spinConfig: SpinConfig = JSON.parse(JSON.stringify(defaultSpinConfig));

function ensureUser(userId: string): LoyaltyUser {
  let u = store.get(userId);
  if (!u) {
    // Demo-friendly starting state: Silver tier, head-start cup, one spin.
    u = {
      points: 1240,
      // Rolling-12m spend ≈ 150 JOD → Silver. The 400-day-old entry is OUTSIDE
      // the window and intentionally does not count (§A — tier can drop).
      spendLog: [
        { amount: 60, at: Date.now() - 86400000 * 30 },
        { amount: 50, at: Date.now() - 86400000 * 120 },
        { amount: 40, at: Date.now() - 86400000 * 300 },
        { amount: 200, at: Date.now() - 86400000 * 400 },
      ],
      cup: { current: config.CUP_HEAD_START, target: config.CUP_TARGET },
      walletBalance: 12.5,
      vouchers: [
        {
          id: genId('vch'),
          titleAr: 'مشروب مجاني',
          titleEn: 'Free drink',
          type: 'free-item',
          expiresAt: new Date(Date.now() + 86400000 * 14).toISOString(),
        },
      ],
      history: [
        { id: genId('log'), deltaPoints: 240, reasonAr: 'مكافأة ترحيبية', reasonEn: 'Welcome bonus', createdAt: new Date(Date.now() - 86400000 * 10).toISOString() },
        { id: genId('log'), deltaPoints: 15, reasonAr: 'طلب لاتيه', reasonEn: 'Latte order', createdAt: new Date(Date.now() - 86400000 * 7).toISOString() },
      ],
      visits: 4,
      lastEarnAt: Date.now() - 86400000 * 7, // last earned a week ago
      spinsAvailable: 1,
      hasRatedBranchEver: false,
      hasReferralRewardEver: false,
      referralCode: `ALM${Math.floor(1000 + Math.random() * 9000)}`,
      phone: '',
    };
    store.set(userId, u);
  }
  return u;
}

const EXPIRY_MS = config.BEAN_EXPIRY_MONTHS * 30 * 86400000;

/** Top tiers (Gold/Black) never expire; lower tiers expire after inactivity. */
function beansExpireAt(u: LoyaltyUser, tierId: string): string | null {
  if (tierId === 'gold' || tierId === 'black') return null;
  return new Date(u.lastEarnAt + EXPIRY_MS).toISOString();
}

function buildBalance(userId: string, u: LoyaltyUser): LoyaltyBalance {
  const windowSpend = rolling12mSpend(u);
  const tier = tierFromSpend(windowSpend);
  // Enforce gentle expiry: lower tiers lose beans after a long inactivity gap.
  if (tier.id !== 'gold' && tier.id !== 'black' && Date.now() > u.lastEarnAt + EXPIRY_MS) {
    u.points = 0;
  }
  return {
    userId,
    points: u.points,
    windowSpend,
    tier: tier.id,
    multiplier: tier.multiplier,
    cup: u.cup,
    beansExpireAt: beansExpireAt(u, tier.id),
  };
}

/** Spins available = banked spins + a free-spin-day grant + active campaign grant. */
function computeEligibility(u: LoyaltyUser): SpinEligibility {
  if (!spinConfig.eligibility.enabled) return { canSpin: false, spinsAvailable: 0 };
  let available = u.spinsAvailable;
  const today = new Date();
  if (spinConfig.eligibility.freeSpinDays.includes(today.getDay())) {
    available += 1;
  }
  // Active scheduled campaign (today within start/end) can also grant a spin.
  const todayIso = today.toISOString().slice(0, 10);
  const hasActiveCampaign = spinConfig.campaigns.some(
    (c) => c.active && c.startDate <= todayIso && c.endDate >= todayIso,
  );
  if (hasActiveCampaign) available += 1;
  return { canSpin: available > 0, spinsAvailable: available };
}

export const mockLoyaltyService: LoyaltyService = {
  getBalance: (userId) => {
    const u = ensureUser(userId);
    return delay(buildBalance(userId, u));
  },

  getVouchers: (userId) => {
    const u = ensureUser(userId);
    const active = u.vouchers.filter((v) => !v.used && new Date(v.expiresAt) > new Date());
    return delay(active);
  },

  // Redeem beans for a catalog Reward → issue a voucher. Beans have NO cash
  // value and are never moved to the wallet (Starbucks model).
  redeemReward: (userId, input) => {
    const u = ensureUser(userId);
    if (input.beans > u.points) return Promise.reject(new Error('Not enough beans'));
    u.points -= input.beans;
    const voucher: Voucher = {
      id: genId('vch'),
      titleAr: input.titleAr,
      titleEn: input.titleEn,
      type: input.type,
      value: input.value,
      expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
    };
    u.vouchers.unshift(voucher);
    u.history.unshift({
      id: genId('log'), deltaPoints: -input.beans,
      reasonAr: `استبدال مكافأة: ${input.titleAr}`,
      reasonEn: `Redeemed reward: ${input.titleEn}`,
      createdAt: new Date().toISOString(),
    });
    return delay({ points: u.points, voucher });
  },

  // Mirror of section 8.2 earn calculation.
  earn: ({ userId, invoiceAmount, paidFromBalance, isFriday, bonusMultiplier }: EarnInput) => {
    const u = ensureUser(userId);
    // Tier multiplier uses the rolling-12-month spend (§A).
    const tier = tierFromSpend(rolling12mSpend(u));
    // Pay-from-wallet ×1.5 and an activated bonus-day multiplier both apply to
    // ALL beans BEFORE the tier multiplier; the tier then stacks on top
    // (Wallet spec §1.2). E.g. Gold + wallet + double-day = ×1.5 × ×2 × ×1.5.
    const walletMult = paidFromBalance ? config.WALLET_EARN_MULTIPLIER : 1;
    const bonusMult = bonusMultiplier && bonusMultiplier > 1 ? bonusMultiplier : 1;
    const basePoints = invoiceAmount * config.POINTS_PER_JOD * walletMult * bonusMult;
    const tierBonus = basePoints * (tier.multiplier - 1);
    const friday = isFriday ?? new Date().getDay() === 5;
    const fridayBonus = friday ? basePoints * 0.5 : 0;
    const pointsEarned = Math.round(basePoints + tierBonus + fridayBonus);
    u.lastEarnAt = Date.now();

    u.points += pointsEarned;
    u.spendLog.push({ amount: invoiceAmount, at: Date.now() });
    u.visits += 1;

    // Cup fill uses the same pay-from-balance multiplier for consistency.
    const cupBeans = paidFromBalance ? config.WALLET_EARN_MULTIPLIER : 1;
    u.cup.current = Math.min(u.cup.target, u.cup.current + cupBeans);
    let freeDrinkIssued = false;
    if (u.cup.current >= u.cup.target) {
      freeDrinkIssued = true;
      u.vouchers.unshift({
        id: genId('vch'), titleAr: 'مشروب مجاني 🎉', titleEn: 'Free drink 🎉',
        type: 'free-item', expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
      });
      u.cup.current = config.CUP_HEAD_START; // reset to head-start
    }

    // Grant a spin every N visits (section 2.4).
    if (u.visits % spinConfig.eligibility.visitsPerSpin === 0) {
      u.spinsAvailable += 1;
    }

    u.history.unshift({
      id: genId('log'), deltaPoints: pointsEarned,
      reasonAr: paidFromBalance ? 'حبات طلب (+50% دفع من الرصيد)' : 'حبات طلب',
      reasonEn: paidFromBalance ? 'Order beans (+50% wallet)' : 'Order beans',
      createdAt: new Date().toISOString(),
    });

    return delay({ pointsEarned, cup: { ...u.cup }, freeDrinkIssued });
  },

  getHistory: (userId) => delay(ensureUser(userId).history),

  getSpinConfig: () => delay(spinConfig),

  getSpinEligibility: (userId) => delay(computeEligibility(ensureUser(userId))),

  spin: (userId) => {
    const u = ensureUser(userId);
    const elig = computeEligibility(u);
    if (!elig.canSpin) return Promise.reject(new Error('No spins available'));

    const { prize, index } = pickWeightedPrize(spinConfig.prizes);
    // Consume a banked spin if any (free-spin-day/campaign grants aren't banked).
    if (u.spinsAvailable > 0) u.spinsAvailable -= 1;

    // Issue the prize as a voucher / wallet credit.
    if (prize.type === 'credit' && prize.creditValue) {
      u.walletBalance += prize.creditValue;
    }
    u.vouchers.unshift({
      id: genId('vch'),
      titleAr: prize.nameAr, titleEn: prize.nameEn,
      type: prize.type === 'credit' ? 'credit' : 'free-item',
      value: prize.creditValue,
      expiresAt: new Date(Date.now() + prize.expiryDays * 86400000).toISOString(),
    });
    u.history.unshift({
      id: genId('log'), deltaPoints: 0,
      reasonAr: `عجلة الحظ: ${prize.nameAr}`, reasonEn: `Wheel: ${prize.nameEn}`,
      createdAt: new Date().toISOString(),
    });

    return delay({ prize, prizeIndex: index }, 500);
  },

  getWallet: (userId) => delay(ensureUser(userId).walletBalance),

  topUp: (userId, amount) => {
    const u = ensureUser(userId);
    u.walletBalance += amount;
    // Digital reload bonus beans (pre-commitment lever): grant the highest
    // qualifying tier's bonus and log it.
    const bonus = reloadBonusBeans(amount);
    if (bonus > 0) {
      u.points += bonus;
      u.history.unshift({
        id: genId('log'), deltaPoints: bonus,
        reasonAr: `مكافأة شحن المحفظة (+${bonus} حبة)`,
        reasonEn: `Wallet reload bonus (+${bonus} beans)`,
        createdAt: new Date().toISOString(),
      });
    }
    u.lastEarnAt = Date.now(); // a reload counts as activity (extends beans)
    // Top-up of the configured amount grants a spin (section 2.4).
    if (amount >= spinConfig.eligibility.topupAmount) u.spinsAvailable += 1;
    return delay(u.walletBalance);
  },

  sendGift: (input) => {
    seedGifts();
    // Pay for the gift from the sender's wallet when it covers the amount
    // (otherwise treated as an external card payment in the mock).
    const sender = ensureUser(input.senderId);
    if (sender.walletBalance >= input.amount) {
      sender.walletBalance -= input.amount;
      sender.history.unshift({
        id: genId('log'), deltaPoints: 0,
        reasonAr: `شراء بطاقة هدية (-${input.amount.toFixed(3)} د.أ)`,
        reasonEn: `Gift card purchase (-${input.amount.toFixed(3)} JOD)`,
        createdAt: new Date().toISOString(),
      });
    }
    const gift: GiftCard = {
      id: genId('gift'),
      code: genGiftCode(),
      designId: input.designId,
      amount: input.amount,
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
      message: input.message,
      senderId: input.senderId,
      createdAt: new Date().toISOString(),
      redeemed: false,
    };
    gifts.set(gift.code, gift);
    return delay(gift, 400);
  },

  getSentGifts: (userId) => {
    seedGifts();
    const list = [...gifts.values()]
      .filter((g) => g.senderId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return delay(list);
  },

  redeemGiftCode: (userId, code) => {
    seedGifts();
    const gift = gifts.get(code.trim().toUpperCase());
    if (!gift) return Promise.reject(new Error('Invalid gift code'));
    if (gift.redeemed) return Promise.reject(new Error('Gift already redeemed'));
    gift.redeemed = true;
    const u = ensureUser(userId);
    u.walletBalance += gift.amount; // gift balance flows into the wallet
    u.history.unshift({
      id: genId('log'), deltaPoints: 0,
      reasonAr: `بطاقة هدية (+${gift.amount.toFixed(3)} د.أ)`,
      reasonEn: `Gift card (+${gift.amount.toFixed(3)} JOD)`,
      createdAt: new Date().toISOString(),
    });
    return delay({ amount: gift.amount, walletBalance: u.walletBalance });
  },

  chargeWallet: (userId, amount) => {
    const u = ensureUser(userId);
    if (amount > u.walletBalance) return Promise.reject(new Error('Insufficient wallet balance'));
    u.walletBalance -= amount;
    u.history.unshift({
      id: genId('log'), deltaPoints: 0,
      reasonAr: `دفع من المحفظة (-${amount.toFixed(3)} د.أ)`,
      reasonEn: `Wallet payment (-${amount.toFixed(3)} JOD)`,
      createdAt: new Date().toISOString(),
    });
    return delay({ walletBalance: u.walletBalance });
  },

  // POS not connected in the mock — the till never reports a scan.
  getScanStatus: () => delay({ scanned: false }),

  getReferralCode: (userId) => {
    const u = ensureUser(userId);
    return delay({ code: u.referralCode, alreadyRewarded: u.hasReferralRewardEver });
  },

  // Referral logic mirrors section 8.1.1 (referrer-only, once per account).
  claimReferral: (referrerId, referredPhone) => {
    const u = ensureUser(referrerId);
    if (u.hasReferralRewardEver) return delay({ rewarded: false });
    if (referredPhone === u.phone) return delay({ rewarded: false }); // self-referral
    if (knownPhones.has(referredPhone)) return delay({ rewarded: false }); // not a new user
    // Assume OTP-verified at claim time in mock; mark phone as known.
    knownPhones.add(referredPhone);
    u.hasReferralRewardEver = true;
    u.points += 50;
    u.history.unshift({
      id: genId('log'), deltaPoints: 50,
      reasonAr: 'مكافأة دعوة صديق', reasonEn: 'Referral reward', createdAt: new Date().toISOString(),
    });
    return delay({ rewarded: true });
  },

  // Branch rating: 50 pts once per account lifetime, but always save rating (section 8.1.1).
  rateBranch: ({ userId }) => {
    const u = ensureUser(userId);
    if (u.hasRatedBranchEver) return delay({ rewarded: false });
    u.hasRatedBranchEver = true;
    u.points += 50;
    u.history.unshift({
      id: genId('log'), deltaPoints: 50,
      reasonAr: 'مكافأة تقييم الفرع', reasonEn: 'Branch rating reward', createdAt: new Date().toISOString(),
    });
    return delay({ rewarded: true });
  },
};

/** Test/admin hook so the in-app mock and admin demo can share config changes. */
export function __setMockSpinConfig(cfg: SpinConfig) {
  spinConfig = cfg;
}
