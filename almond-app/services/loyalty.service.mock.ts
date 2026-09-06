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
import type { GiftCard, Subscription, PaymentMethodId } from '@/types';
import type { LoyaltyService, EarnInput } from './loyalty.service';
import { config } from '@/constants/config';
import { computeEarn } from '@almond/shared/loyalty/earn';
import { expiryAt, isExpired } from '@almond/shared/loyalty/expiry';
import { ammanDayKey, ammanWeekday } from '@almond/shared/lib/ammanWeekday';
// The earn multiplier is computeEarn's business only; this is the tier itself.
// earn-arith-exempt: tier lookup for the expiry rule and the balance. §7 T7.
import { tierFromSpend } from './seed';
import { delay, genId } from './util';
import { defaultSpinConfig, pickWeightedPrize } from './spinDefaults';
import { reloadBonusBeans } from '@/lib/walletBonus';

interface SpendEntry {
  amount: number;
  at: number; // epoch ms
}

export interface LoyaltyUser {
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
  /** Amman day-key of the last free-spin-day / campaign grant claim, and how
   *  many of that day's grants were already banked (D9). */
  grantDay: string;
  grantDayCount: number;
  hasRatedBranchEver: boolean;
  hasReferralRewardEver: boolean;
  referralCode: string;
  phone: string;
  /** "Almond Club" subscription. */
  subRenewsAt: number; // epoch ms; 0 = not subscribed
  subDay: string; // 'YYYY-MM-DD' of last free-drink redemption
  subDayCount: number;
}

const ROLLING_WINDOW_MS = 365 * 86400000;

/** One business day for the whole system (§3.6) — Amman, not UTC; the mirror of
 *  bff/src/backend/memory.ts's todayKey. It moves the daily free-drink
 *  counter's reset from 03:00 Amman to 00:00 Amman. The day BOUNDARY only:
 *  `drinksPerDay` is untouched, and the cap's VALUE is §8.5 (D7). */
const todayKey = (): string => ammanDayKey();
function subStateOf(u: LoyaltyUser): Subscription {
  const active = u.subRenewsAt > Date.now();
  const redeemedToday = active && u.subDay === todayKey() ? u.subDayCount : 0;
  return {
    active,
    renewsAt: active ? new Date(u.subRenewsAt).toISOString() : null,
    drinksPerDay: config.SUBSCRIPTION.drinksPerDay,
    redeemedToday,
    remainingToday: Math.max(0, config.SUBSCRIPTION.drinksPerDay - redeemedToday),
  };
}

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
      grantDay: '', grantDayCount: 0,
      hasRatedBranchEver: false,
      hasReferralRewardEver: false,
      referralCode: `ALM${Math.floor(1000 + Math.random() * 9000)}`,
      phone: '',
      subRenewsAt: 0, subDay: '', subDayCount: 0,
    };
    store.set(userId, u);
  }
  return u;
}

/** Expiry is an EXPLICIT operation, never a side effect of a read (D11).
 *  Returns the points destroyed, so a caller/test can assert it happened.
 *  The RULE is unchanged here — the top rung is still exempt; removing that
 *  exemption is the offer change in §8.3. */
export function expirePoints(u: LoyaltyUser, now = Date.now()): number {
  // earn-arith-exempt: the EXPIRY rule is tier-sensitive (§8.3), not the grant. §7 T7.
  const tier = tierFromSpend(rolling12mSpend(u, now));
  // TODAY'S RULE, unchanged in substance: the top rung is exempt (owner:
  // "الأسود ما بينتهي"). Under the 2/4/6 ladder that is the 6% rung; it used to
  // be Gold+Black on the four-tier ramp. Removing the exemption altogether is
  // the offer change held behind LOYALTY-EARN-PATCH §8.3 — and the liability
  // lane now prices expiry at ~557 JOD/yr harvested, i.e. barely worth having.
  if (tier.id === 'top') return 0;
  if (!isExpired(u.lastEarnAt, now)) return 0;
  const lost = u.points;
  u.points = 0;
  return lost;
}

/** The 6% rung never expires; the rungs below it expire after inactivity. */
export function beansExpireAt(u: LoyaltyUser, tierId: string): string | null {
  if (tierId === 'top') return null;
  return new Date(expiryAt(u.lastEarnAt)).toISOString();
}

function buildBalance(userId: string, u: LoyaltyUser): LoyaltyBalance {
  const windowSpend = rolling12mSpend(u);
  // earn-arith-exempt: tier shown on the balance payload; no invoice, no grant. §7 T7.
  const tier = tierFromSpend(windowSpend);
  // NOTE: expiry is an explicit job (expirePoints), never a side effect of a
  // read. buildBalance is called from getBalance — a GET must not mutate.
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

/** How many spins today's free-spin day / active campaign grant — at most one
 *  each. The day is the Amman business day (§3.6), never the host clock. */
function dailyGrantsDue(at: Date): number {
  if (!spinConfig.eligibility.enabled) return 0;
  let due = 0;
  if (spinConfig.eligibility.freeSpinDays.includes(ammanWeekday(at))) due += 1;
  const key = ammanDayKey(at);
  const hasActiveCampaign = spinConfig.campaigns.some(
    (c) => c.active && c.startDate <= key && c.endDate >= key,
  );
  if (hasActiveCampaign) due += 1;
  return due;
}

/** Bank today's grants into `spinsAvailable`, once per Amman day. Before this,
 *  the grants were added to the eligibility COUNT but never consumed by spin(),
 *  so canSpin stayed true all day and the wheel was unlimited (D9). */
function claimDailyGrants(u: LoyaltyUser, at = new Date()): void {
  const key = ammanDayKey(at);
  if (u.grantDay !== key) {
    u.grantDay = key;
    u.grantDayCount = 0;
  }
  const due = dailyGrantsDue(at);
  if (due > u.grantDayCount) {
    u.spinsAvailable += due - u.grantDayCount;
    u.grantDayCount = due;
  }
}

/** Spins available = banked spins, after today's grants have been banked.
 *  Eligibility and consumption read the SAME counter so they cannot disagree. */
function computeEligibility(u: LoyaltyUser): SpinEligibility {
  if (!spinConfig.eligibility.enabled) return { canSpin: false, spinsAvailable: 0 };
  claimDailyGrants(u);
  return { canSpin: u.spinsAvailable > 0, spinsAvailable: u.spinsAvailable };
}

export const mockLoyaltyService: LoyaltyService = {
  getBalance: (userId) => {
    const u = ensureUser(userId);
    expirePoints(u, Date.now()); // explicit, before the response is built
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
  earn: ({ userId, invoiceAmount, paidFromBalance, at, bonusDayActivated, comboPairs }: EarnInput) => {
    const u = ensureUser(userId);
    // Expiry runs BEFORE the grant, explicitly — never as a side effect of a
    // read (D11). See expirePoints above.
    expirePoints(u, Date.now());
    // ONE earn calculation, shared with the BFF (packages/shared/src/loyalty/earn.ts).
    // The mock must never re-implement it — see docs/LOYALTY-EARN-PATCH.md §3.
    const earn = computeEarn({
      total: invoiceAmount,   // tax-inclusive, per §1.1
      windowSpend: rolling12mSpend(u),
      paidFromBalance,
      comboPairs,
      bonusDayActivated,
      at,
    });
    const pointsEarned = earn.points;
    u.lastEarnAt = Date.now();

    u.points += pointsEarned;
    u.spendLog.push({ amount: invoiceAmount, at: Date.now() });
    u.visits += 1;

    // Cup fill uses the same pay-from-balance multiplier for consistency.
    // earn-arith-exempt: cup stamps, not points — no invoice, no grant. §7 T7.
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
      reasonAr: paidFromBalance ? 'نقاط طلب (+50% دفع من الرصيد)' : 'نقاط طلب',
      reasonEn: paidFromBalance ? 'Order points (+50% wallet)' : 'Order points',
      createdAt: new Date().toISOString(),
    });

    // The combo bonus is already INSIDE pointsEarned (computeEarn adds it).
    // Log it for transparency; never add it again.
    if (earn.comboBonus > 0) {
      u.history.unshift({
        id: genId('log'), deltaPoints: 0,
        reasonAr: `تتضمن مكافأة كومبو (${earn.comboBonus} نقطة)`,
        reasonEn: `Includes combo bonus (${earn.comboBonus} points)`,
        createdAt: new Date().toISOString(),
      });
    }

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
    // Every spin — banked, free-spin-day or campaign — is consumed from the one
    // counter computeEligibility just claimed into. canSpin implies > 0 (D9).
    u.spinsAvailable -= 1;

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

  getSubscription: (userId) => delay(subStateOf(ensureUser(userId))),

  subscribe: (userId, paymentMethod: PaymentMethodId) => {
    const u = ensureUser(userId);
    const price = config.SUBSCRIPTION.priceJod;
    if (paymentMethod === 'wallet') {
      if (u.walletBalance < price) return Promise.reject(new Error('insufficient_wallet'));
      u.walletBalance -= price;
    }
    u.subRenewsAt = Date.now() + config.SUBSCRIPTION.periodDays * 86400000;
    u.history.unshift({
      id: genId('log'), deltaPoints: 0,
      reasonAr: 'اشتراك نادي ألموند', reasonEn: 'Almond Club subscription',
      createdAt: new Date().toISOString(),
    });
    return delay({ subscription: subStateOf(u), walletBalance: u.walletBalance });
  },

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
        reasonAr: `مكافأة شحن المحفظة (+${bonus} نقطة)`,
        reasonEn: `Wallet reload bonus (+${bonus} points)`,
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

/** Test hook: the stored user record, so a test can age `lastEarnAt` past the
 *  expiry window. There is no public way to build a stale member (§7 T15). */
export function __getMockUser(userId: string): LoyaltyUser {
  return ensureUser(userId);
}
