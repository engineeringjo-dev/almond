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
import type { GiftCard, Subscription, PaymentMethodId, TierId } from '@/types';
import type { LoyaltyService, EarnInput } from './loyalty.service';
import { config } from '@/constants/config';
import { computeEarn } from '@almond/shared/loyalty/earn';
import {
  consumeFifo, expiredBetween, grantLot, liveBalance, lotRulesFromConfig, migrateBalance,
  nextExpiry, pruneLots, type PointLot,
} from '@almond/shared/loyalty/lots';
import {
  evaluationPeriod, holdRung, qualifiedRung, spendEntry, standing, windowRulesFromConfig,
  type SpendEntry,
} from '@almond/shared/loyalty/window';
import { ammanDayKey, ammanWeekday } from '@almond/shared/lib/ammanWeekday';
// The earn multiplier is computeEarn's business only; this is the tier itself.
// earn-arith-exempt: tier lookup for the balance payload. §7 T7.
import { tiers } from './seed';
import { delay, genId } from './util';
import { defaultSpinConfig, pickWeightedPrize } from './spinDefaults';
import { reloadBonusBeans } from '@/lib/walletBonus';

export interface LoyaltyUser {
  /**
   * 🔴 THE POINT LEDGER — one row per grant, each with its own 12-month clock.
   * This replaced `points: number`, and the balance is now `liveBalance(u.lots)`
   * on every read. Owner: «كل نقطة تعيش ١٢ شهر ولا تتجدد بشراء جديد وصرف النقاط
   * FIFO». The rows and every function that touches them are the SHARED ones
   * (@almond/shared/loyalty/lots), never a second local definition — the same
   * argument that made `spendLog` shared, with money in it: if the phone
   * computes 240 and the server computes 200, the member is refused a
   * redemption they can see on their screen.
   */
  lots: PointLot[];
  /** The Amman day key through which expiry has been written into `history`.
   *  The BALANCE never needs this — a dead lot contributes 0 to every sum from
   *  the instant it dies. Only the ledger LINE does. */
  expirySettledThrough: string;
  /**
   * Every qualifying purchase, dated by the AMMAN day it happened on. The type
   * and the window that reads it are the SHARED ones
   * (@almond/shared/loyalty/window), not a second local definition — the local
   * one measured a rolling 365 days while the BFF measured "forever", so the
   * same member could be two different tiers on the phone and on the server.
   * One window, in one place, used by both.
   *
   * Unlike the BFF's log this one is deliberately NOT pruned, so the seeded
   * 400-day-old entry keeps demonstrating the roll-off.
   */
  spendLog: SpendEntry[];
  /** The floor: the best rung ever qualified for. There is no demotion, so it
   *  may only ever rise, and only through holdRung(). */
  heldTierId: TierId;
  /** Latest evaluation period closed, e.g. '2026-Q3'. Carried so this record
   *  has the same shape as the BFF's Member; the APP never closes a period —
   *  the requalification stamp belongs to the server (Odoo gate 4's cron). */
  evaluatedThrough: string;
  cup: CupState;
  walletBalance: number;
  vouchers: Voucher[];
  history: PointsLogEntry[];
  visits: number;
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

/** The 90-day window, read once from config — the same object the BFF reads. */
const WINDOW = windowRulesFromConfig();
/** The lot life, read once from config — the mirror of WINDOW, and the same
 *  object bff/src/backend/memory.ts reads. */
const LOTS = lotRulesFromConfig();

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

/** The member's rung, window spend and visit days — the shared computation,
 *  never a local one. Pure: it mutates nothing (D11). */
function standingOf(u: LoyaltyUser, at: Date = new Date()) {
  return standing(u.spendLog, u.heldTierId, WINDOW, at);
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
    // Demo-friendly starting state: the ENTRY rung, two visit days banked,
    // head-start cup, one spin.
    u = {
      // 🔴 1,240 POINTS AS TWO LOTS, NOT ONE SCALAR — the seed is the only
      // place the per-lot rule can be SEEN without a test fixture. 1,000 points
      // granted 355 days ago are ten days from dying (so `nextExpiry` is
      // non-null and HomeNudge's expiring-soon window really fires), and 240
      // granted ten days ago are not. A redemption takes the older thousand
      // first, which is the FIFO rule on screen.
      //
      // `source: 'migration'` because a seeded opening balance is exactly that:
      // points this system did not grant. THE BACK-DATING IS A DEMO OF A MATURE
      // MEMBER — the real migration dates every lot at the cutover day (see
      // migrationLot: a rule may not take money retroactively).
      lots: grantLot(
        migrateBalance(1000, ammanDayKey(new Date(Date.now() - 86400000 * 355)), LOTS),
        240, 'migration', new Date(Date.now() - 86400000 * 10), LOTS,
      ).lots,
      expirySettledThrough: ammanDayKey(),
      // 🔴 THE SEED DECIDES WHETHER W4'S CENTREPIECE RENDERS AT ALL.
      //
      // It was 72 JOD over three in-window days with `heldTierId: 'top'`, i.e.
      // >= 65 JOD — the LAST rung. `standing().next` is null there, so
      // tierProgressCopy() returns null and all three render sites drop the
      // line: LoyaltyCard (`if (!progress) return null`), rewards.tsx
      // (`isCurrent && progress ? … : null`) and TierProgress (which falls back
      // to loyalty.tierMax). config.DATA_SOURCE is 'mock', this mock is the
      // app's ONLY data source, and `store` is a fresh Map on every launch — so
      // every user, every launch, was on the top rung and the progress sentence
      // the whole tier mechanic rests on was rendered for nobody. 222 unit
      // tests could not see it: each one builds its own balance.
      //
      // 12 JOD over two in-window days is inside the entry rung and two visit
      // days short of the 4-visit door, so the demo shows the real sentence
      // ("2 more visits and your cashback DOUBLES ×2") on a GUARANTEED count.
      // It matches almond-web's seed, which was moved to 12 for the same
      // reason. The 400-day entry is kept exactly as it was: it is the roll-off
      // demonstration.
      spendLog: [
        spendEntry(7.5, new Date(Date.now() - 86400000 * 5)),
        spendEntry(4.5, new Date(Date.now() - 86400000 * 30)),
        spendEntry(200, new Date(Date.now() - 86400000 * 400)),
      ],
      heldTierId: 'base',
      evaluatedThrough: evaluationPeriod(ammanDayKey(), WINDOW.evaluation),
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

/**
 * Write the ledger LINE for points that have died since this member was last
 * settled, then drop the rows nothing needs any more. Returns the points booked
 * as expired, so a caller or a test can assert it happened.
 *
 * 🔴 THIS IS NOT WHAT MAKES THE BALANCE FALL, and that is the whole difference
 * from the `expirePoints` it replaced. That function was a MUTATION A READ HAD
 * TO TRIGGER — hence `expirePoints(u, Date.now())` sprinkled through getBalance
 * and earn, a comment insisting "a GET must not mutate", and a test whose job
 * was to police the contradiction. Under a ledger `liveBalance(u.lots)` is
 * already 0 for a dead lot, for every caller, from the instant it dies, so D11
 * holds by construction and there is nothing for a read to trigger. What is
 * left is the history row, which is only worth writing on a write path.
 *
 * There is also NO TIER EXEMPTION any more, and there cannot be one: the rule
 * lives in @almond/shared/loyalty/lots.ts, which does not import the tier table
 * at all. «لا إعفاء — القاعدة للجميع».
 */
export function settleExpiry(u: LoyaltyUser, at: Date = new Date()): number {
  const today = ammanDayKey(at);
  const lost = expiredBetween(u.lots, u.expirySettledThrough, today);
  if (lost > 0) {
    u.history.unshift({
      id: genId('log'), deltaPoints: -lost,
      reasonAr: 'انتهاء صلاحية نقاط', reasonEn: 'Points expired',
      createdAt: at.toISOString(),
    });
  }
  u.expirySettledThrough = today;
  // After the loss is booked, never before — pruning first would take the rows
  // the history line is derived from with it.
  u.lots = pruneLots(u.lots, at, LOTS);
  return lost;
}

function buildBalance(userId: string, u: LoyaltyUser): LoyaltyBalance {
  // ONE window, the shared one. `windowSpend` here is the same number the BFF
  // puts on GET /v1/me/balance, computed by the same function.
  const st = standingOf(u);
  // earn-arith-exempt: tier shown on the balance payload; no invoice, no grant. §7 T7.
  const tier = tiers.find((x) => x.id === st.held.id) ?? tiers[0];
  // A PURE READ. The balance is derived from the lots on every call, so it
  // cannot be stale and there is no expiry job for this path to have missed
  // (D11 is satisfied by construction — see settleExpiry).
  const at = new Date();
  return {
    userId,
    points: liveBalance(u.lots, at),
    windowSpend: st.windowSpend,
    visitDays: st.visitDays,
    tier: tier.id,
    multiplier: tier.multiplier,
    // The progress copy is written in VISITS and it must come from the real
    // standing, not from a spend projection: standing() knows the 4-visits door
    // and the no-demotion floor, and `progressToNextTier(windowSpend)` knows
    // neither. `null` here means the top rung — the sentence disappears.
    nextTier: st.next
      ? {
          id: st.next.rung.id as TierId,
          jodRemaining: st.next.jodRemaining,
          visitsRemaining: st.next.visitsRemaining,
          // The door is a guarantee; the spend projection above it is not. The
          // copy layer needs to know which one it was handed.
          visitsGuaranteed: st.next.visitsGuaranteed,
          step: st.next.step,
        }
      : null,
    cup: u.cup,
    // WHICH points die next, and HOW MANY. Not one date for the whole balance:
    // this member holds grants made months apart and each one dies on its own
    // day. The tier is not consulted — «لا إعفاء».
    nextExpiry: nextExpiry(u.lots, at),
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
    // Nothing to run first. A dead lot is already worth 0 to buildBalance, so
    // this GET reads the right number while mutating nothing at all (D11).
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
    settleExpiry(u);
    // 🔴 OLDEST LOT FIRST, AND THE SHORTFALL IS FOUND BEFORE ANY DEBIT.
    // consumeFifo checks the live total first and returns a refusal that has
    // written nothing; a lot consumed only in part keeps its own grant date and
    // its own expiry day, so the remainder dies when it was always going to.
    const spend = consumeFifo(u.lots, input.beans, new Date());
    if (!spend.ok) return Promise.reject(new Error('Not enough beans'));
    u.lots = spend.lots;
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
    return delay({ points: liveBalance(u.lots), voucher });
  },

  // Mirror of section 8.2 earn calculation.
  earn: ({
    userId, invoiceAmount, paidFromBalance, at, bonusDayActivated, comboPairs, pointsRedeemed,
  }: EarnInput) => {
    const u = ensureUser(userId);
    // Book any expiry that has come due into the history BEFORE the grant, so
    // the ledger reads in order. It does not change what is granted, and it
    // does not renew anything: «ولا تتجدد بشراء جديد».
    settleExpiry(u, at ?? new Date());
    // The standing BEFORE this transaction — the same read the BFF's checkout
    // route does, so the phone and the server grant on the same window.
    const st = standingOf(u, at ?? new Date());
    // ONE earn calculation, shared with the BFF (packages/shared/src/loyalty/earn.ts).
    // The mock must never re-implement it — see docs/LOYALTY-EARN-PATCH.md §3.
    const earn = computeEarn({
      total: invoiceAmount,   // tax-inclusive, per §1.1
      // The part of the bill paid with points earns nothing — the phone must
      // show the same grant the server will pay, so it passes the same field.
      // Undefined here today: this mock has no rail that spends points against
      // an invoice either (redeemReward issues a voucher; the BFF's
      // /v1/loyalty/redeem is a separate call with no order id), so it forwards
      // whatever the caller states and never guesses.
      pointsRedeemed,
      windowSpend: st.windowSpend,
      heldRungId: st.held.id, // a FLOOR — there is no demotion
      paidFromBalance,
      comboPairs,
      bonusDayActivated,
      at,
    });
    const pointsEarned = earn.points;

    // ONE GRANT, ONE LOT, ONE CLOCK. It is appended; no existing lot is touched,
    // re-dated or extended. A zero grant (a small invoice) appends nothing.
    u.lots = grantLot(u.lots, pointsEarned, 'earn', at ?? new Date(), LOTS).lots;
    // Dated by the AMMAN day, by the same helper the BFF uses. Not pruned here:
    // the seeded 400-day entry is the mock's roll-off demonstration.
    u.spendLog.push(spendEntry(invoiceAmount, at ?? new Date()));
    // 🔴 The only assignment of heldTierId, and it names holdRung — which
    // cannot lower a floor. W1-2 in bff/test/window.test.ts asserts that.
    const after = standingOf(u, at ?? new Date());
    u.heldTierId = holdRung(u.heldTierId, qualifiedRung(after.windowSpend, after.visitDays, WINDOW), WINDOW).id as TierId;
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
      // No "+50% wallet" clause: config.WALLET_EARN_MULTIPLIER is 1.0, so the
      // ledger row was claiming a bonus that computeEarn never granted — a
      // receipt that disagrees with the balance beside it.
      reasonAr: 'نقاط طلب',
      reasonEn: 'Order points',
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
    settleExpiry(u);
    if (bonus > 0) {
      // A lot of its own, with its own 12 months. This line used to be followed
      // by `u.lastEarnAt = Date.now(); // a reload counts as activity (extends
      // beans)` — which WAS the inactivity rule in one line. A top-up grants
      // points; it renews nothing.
      u.lots = grantLot(u.lots, bonus, 'bonus', new Date(), LOTS).lots;
      u.history.unshift({
        id: genId('log'), deltaPoints: bonus,
        reasonAr: `مكافأة شحن المحفظة (+${bonus} نقطة)`,
        reasonEn: `Wallet reload bonus (+${bonus} points)`,
        createdAt: new Date().toISOString(),
      });
    }
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

  /**
   * An obviously unsigned code, of the real code's shape.
   *
   * THE MOCK IS WHERE THE STATIC BARCODE WOULD COME BACK, so it is worth being
   * explicit about what this returns and why.
   *
   * Shape: `<opaque>.<signature>`, the same two halves the BFF mints
   * (`base64url(payload).base64url(hmac)`), so the screen, the refresh timer
   * and the wire parser all exercise the identical path under DATA_SOURCE
   * 'mock'. Content: a fresh random id and a signature half that says, in
   * words, that it is not a signature. The mock holds no secret and must not
   * look as though it does — an ersatz HMAC here would be a credential-shaped
   * object minted inside a client bundle, which is the thing this whole package
   * removes.
   *
   * It ROTATES on every call, so the refresh cadence is visible in the demo
   * (the QR really does change) and a test can prove the code is not a constant
   * derived from the member id — which is exactly what the retired string was.
   *
   * `expiresIn` is config.POS_TOKEN_TTL_SECONDS, the SHARED number the BFF
   * mints with. Not a literal: a mock that reported a different lifetime would
   * tune the phone's refresh cadence against a figure production does not use.
   */
  getPosToken: (userId, mode) => {
    ensureUser(userId);
    return delay({
      token: `${genId('posmock')}-${Math.random().toString(36).slice(2, 10)}.mock-unsigned-not-a-real-signature`,
      expiresIn: config.POS_TOKEN_TTL_SECONDS,
      mode,
    });
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
    settleExpiry(u);
    u.lots = grantLot(u.lots, 50, 'bonus', new Date(), LOTS).lots;
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
    settleExpiry(u);
    u.lots = grantLot(u.lots, 50, 'bonus', new Date(), LOTS).lots;
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

/** Test hook: the stored user record, so a test can build a ledger of its own —
 *  back-dated lots, a spend log, a held rung. There is no public way to build a
 *  member holding points that are about to die (§7 T15). */
export function __getMockUser(userId: string): LoyaltyUser {
  return ensureUser(userId);
}
