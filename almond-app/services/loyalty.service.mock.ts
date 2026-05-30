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
import type { LoyaltyService, EarnInput } from './loyalty.service';
import { config } from '@/constants/config';
import { tierFromSpend } from './seed';
import { delay, genId } from './util';
import { defaultSpinConfig, pickWeightedPrize } from './spinDefaults';

interface LoyaltyUser {
  points: number;
  lifetimeSpend: number;
  cup: CupState;
  walletBalance: number;
  vouchers: Voucher[];
  history: PointsLogEntry[];
  visits: number;
  spinsAvailable: number;
  hasRatedBranchEver: boolean;
  hasReferralRewardEver: boolean;
  referralCode: string;
  phone: string;
}

const store = new Map<string, LoyaltyUser>();
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
      lifetimeSpend: 250,
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

function buildBalance(userId: string, u: LoyaltyUser): LoyaltyBalance {
  const tier = tierFromSpend(u.lifetimeSpend);
  return {
    userId,
    points: u.points,
    lifetimeSpend: u.lifetimeSpend,
    tier: tier.id,
    multiplier: tier.multiplier,
    cup: u.cup,
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

  redeem: (userId, points) => {
    const u = ensureUser(userId);
    if (points > u.points) return Promise.reject(new Error('Not enough points'));
    u.points -= points;
    const jod = points / config.POINTS_PER_JOD_REDEEM; // 100 pts = 1 JOD
    u.walletBalance += jod;
    u.history.unshift({
      id: genId('log'), deltaPoints: -points,
      reasonAr: `استبدال ${jod.toFixed(3)} د.أ`, reasonEn: `Redeemed ${jod.toFixed(3)} JOD`,
      createdAt: new Date().toISOString(),
    });
    return delay({ points: u.points, walletBalance: u.walletBalance });
  },

  // Mirror of section 8.2 earn calculation.
  earn: ({ userId, invoiceAmount, paidFromBalance, isFriday }: EarnInput) => {
    const u = ensureUser(userId);
    const tier = tierFromSpend(u.lifetimeSpend);
    const basePoints = invoiceAmount * config.POINTS_PER_JOD;
    const tierBonus = basePoints * (tier.multiplier - 1);
    const friday = isFriday ?? new Date().getDay() === 5;
    const fridayBonus = friday ? basePoints * 0.5 : 0;
    const pointsEarned = Math.round(basePoints + tierBonus + fridayBonus);

    u.points += pointsEarned;
    u.lifetimeSpend += invoiceAmount;
    u.visits += 1;

    // Cup fill (pay-from-balance = 1.5 beans).
    const cupBeans = paidFromBalance ? 1.5 : 1;
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
      reasonAr: 'نقاط طلب', reasonEn: 'Order points', createdAt: new Date().toISOString(),
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
    // Top-up of the configured amount grants a spin (section 2.4).
    if (amount >= spinConfig.eligibility.topupAmount) u.spinsAvailable += 1;
    return delay(u.walletBalance);
  },

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
