import type {
  CompanyDiscount, CorporateMemberEntry, CorporateEntitlement,
} from '@almond/shared/loyalty/corporate';
import type { RedemptionRow } from '@almond/shared/loyalty/redemption';
import type { OrderType, PaymentMethodId, TierId } from '@almond/shared/types';
import type { EarnBreakdown } from '@almond/shared/loyalty/earn';
import type { HoldoutStamp } from '@almond/shared/loyalty/holdout';
import type { SecondVisitVoucher } from '@almond/shared/loyalty/secondVisit';
import type { MemberProfile } from '@almond/shared/loyalty/profile';
import type { PointLot, WalletLot } from '@almond/shared/loyalty/lots';
import type { SpendEntry, TierStanding, Evaluation } from '@almond/shared/loyalty/window';

export interface Member {
  id: string;
  phone: string;
  name: string;
  /**
   * 🔴 THE POINT LEDGER. This replaced `points: number`.
   *
   * A scalar cannot say WHEN a point was earned, so it cannot say when that
   * point dies and a redemption cannot know which part of it was spent — and
   * the owner's rule is per-GRANT: «كل نقطة تعيش ١٢ شهر ولا تتجدد بشراء جديد
   * وصرف النقاط FIFO». The balance is therefore `liveBalance(m.lots)`, a
   * DERIVED sum, and there is deliberately no stored number beside it that
   * could disagree. Deleting the scalar rather than shadowing it is the same
   * technique that retired `windowSpend`: every reader becomes a typecheck
   * failure instead of a silent second opinion.
   *
   * All arithmetic on this array lives in @almond/shared/loyalty/lots.ts.
   * Nothing here or anywhere else may write `remaining` by hand.
   */
  lots: PointLot[];
  /**
   * The Amman day key through which expiry has been BOOKED into `history`.
   *
   * The balance itself needs no sweep — a dead lot contributes 0 to
   * `liveBalance` from the instant it dies, for every reader. This stamp exists
   * only so the member's history carries a line for the loss, and so
   * `unexplainedPoints` (liveBalance − Σ history deltas) stays exact. The
   * mirror of `evaluatedThrough`, and idempotent for the same reason.
   */
  expirySettledThrough: string;
  /**
   * Amman day key of birth, or null. Fed by the profile form; the tier cards
   * have promised a birthday benefit since before there was anywhere to put
   * one. A DAY KEY, never an ISO instant — see MemberProfile.birthday.
   */
  birthday: string | null;
  /**
   * 🔴 WHEN THE PROFILE BONUS WAS PAID — the once-only stamp, and the ONLY
   * thing that stops it being a mint.
   *
   * A TIMESTAMP, not a boolean, and NOT derived from "does this member have a
   * name". Derivation would be wrong in both directions: a member who clears
   * their name would become eligible again, and the Wafii migration — which
   * carries a name for all 47,720 members — could not mark them as already
   * settled without also paying them 0.500 JOD each for a fact we already hold.
   * The migration sets this stamp; see config.PROFILE_COMPLETION_BONUS.
   *
   * `null` means never paid.
   */
  profileBonusAt: string | null;
  /**
   * 🔴 THE MONEY LEDGER. This replaced `walletFils: number`, for the same
   * reason `points: number` became `lots`.
   *
   * Owner, 2026-09-08: top-up balance and gift-card balance are one kind of
   * money with two origins — «نفس رصيد الشحن، لكن اذا شخص اشتراه لنفسه اسمه
   * شحن، اذا حدا اهداه لشخص يصبح gift card» — living «٢ سنة first in first
   * out». A scalar cannot say WHEN a dinar was topped up, so it cannot say when
   * that dinar dies, and a spend cannot know which part of it was consumed.
   *
   * The balance is `liveBalance(m.walletLots)`, DERIVED on every read, with no
   * stored number beside it that could disagree. Deleting the scalar rather
   * than shadowing it makes every reader a typecheck failure instead of a
   * silent second opinion.
   *
   * IN FILS. `remaining` must stay an integer — see WalletLot.
   */
  walletLots: WalletLot[];
  /** The Amman day key through which WALLET expiry has been booked into
   *  `history`. Mirrors `expirySettledThrough` for points; the balance itself
   *  needs no sweep, only the ledger line does. */
  walletExpirySettledThrough: string;
  /**
   * The dated spend log the rolling window is computed from, PRUNED to
   * config.TIER_WINDOW_DAYS on every write.
   *
   * It replaced a single `windowSpend: number` that `addSpend` only ever added
   * to — the ratchet that produced 3,906 promotions and zero demotions in 980
   * days of the live programme. A scalar cannot roll anything off, so no
   * amount of care at the call site could have fixed it.
   *
   * ⚠ NOT A LIFETIME HISTORY. Pruning is lossless for the RATE (nothing outside
   * the window can re-enter it) but it destroys "the member's first ever
   * transaction". Anything needing that — the second-visit voucher — needs its
   * own durable marker and must not read this.
   */
  spend: SpendEntry[];
  /** The floor: the best rung this member has ever qualified for. Written ONLY
   *  through holdRung() (loyalty/window.ts), which cannot lower it. */
  heldTierId: TierId;
  /** Latest evaluation period already closed, e.g. '2026-Q3'. */
  evaluatedThrough: string;
  subRenewsAt: number; // "Almond Club" renewal epoch (ms); 0 = not subscribed
  subDay: string; // 'YYYY-MM-DD' of the last free-drink redemption
  subDayCount: number; // free drinks redeemed on subDay
}

export interface SubscriptionState {
  active: boolean;
  renewsAt: string | null;
  drinksPerDay: number;
  redeemedToday: number;
  remainingToday: number;
}

export interface HistoryEntry {
  deltaPoints: number;
  reasonAr: string;
  reasonEn: string;
  createdAt: string;
}

/** A checkout line references the menu — the server re-prices; it never trusts
 *  client-sent prices or totals. */
export interface CheckoutLine {
  itemId: string;
  sizeId: 'S' | 'M' | 'L';
  optionIds?: string[];
  qty: number;
}

export interface NewOrder {
  memberId: string;
  branchId: string;
  type: OrderType;
  paymentMethod: PaymentMethodId;
  subtotal: number;
  tax: number;
  total: number;
  pointsEarned: number;
  /** Which arm of every running experiment this member was in AT ISSUE TIME
   *  (§4.11's snapshot). Reading group membership at ANALYSIS time instead is
   *  the classic way to invalidate a holdout — see
   *  docs/LOYALTY-ODOO-MODULE.md:763-767 — because a single basis-point edit to
   *  the share silently re-labels every historical order in the affected band.
   *  Recorded here and acted on NOWHERE in this file.
   *
   *  Plural, so a second experiment needs no migration. Optional, so orders
   *  written before this field existed stay valid.
   *
   *  ⚠ WRITE-ONLY IN THIS REPO. No Backend method returns an OrderRecord after
   *  createOrder, no route exposes one, and GET /v1/analytics/order-lines
   *  carries no arm field — so the stamps are readable only by querying the
   *  adapter's order table directly, which is true of Odoo and NOT of the
   *  in-memory adapter (`orders` there is module-private). That is deliberate:
   *  a member-authenticated route that hands back an arm tells the control
   *  group it is the control group. Analysis reads the order table, not the
   *  API. */
  experimentArms?: readonly HoldoutStamp[];
}

export interface OrderRecord extends NewOrder {
  id: string;
  createdAt: string;
  /** The full earn breakdown the grant was derived from (§5b). Absent only
   *  between createOrder() and recordEarnBreakdown() inside the checkout saga,
   *  and on orders written before this field existed. */
  earn?: EarnBreakdown;
}

/** The single seam to the source of truth. `memory` today; `odoo` later. */
/**
 * ONE USE of a standing discount — the row behind «بدي يبين عندي كل موظف شو اخذ
 * درنك، وكم مرة استخدم خصمه».
 *
 * The items are stored as NAMES and quantities rather than ids, because this is
 * a record of what happened and must stay readable after the menu is
 * regenerated — which it now is, from Odoo, on demand. An id-only log would
 * turn into a list of dead references the first time a product is retired.
 */
export interface CorporateUse {
  id: string;
  memberId: string;
  companyId: string;
  /** Canonical phone at the time of use, so the report reads without a join. */
  phone: string;
  /** ISO instant. */
  at: string;
  orderId: string | null;
  /** What they took. `[{ nameAr, nameEn, qty }]`. */
  items: { nameAr: string; nameEn: string; qty: number }[];
  /** The percentage that applied, stored because a company's rate changes and
   *  history must not be rewritten by an edit in the back-office. */
  percentOff: number;
  /** JOD taken off, at the rate above. */
  discountJod: number;
}

export interface Backend {
  findOrCreateByPhone(phone: string, name?: string): Promise<Member>;
  getMember(id: string): Promise<Member>;
  /** Atomic debit; throws conflict('insufficient_wallet') if balance < fils. */
  /** Spend from the wallet, OLDEST LOT FIRST, measured against the LIVE
   *  balance; throws conflict('insufficient_wallet') without touching a lot. */
  debitWallet(id: string, fils: number): Promise<number>;
  /**
   * Add money to the wallet as ONE NEW LOT with its own 24-month clock.
   *
   * `source` is why it arrived — 'topup' when the member paid for it, 'gift'
   * when someone else did, 'refund' when a saga compensated. It does NOT change
   * what the money is worth or what it earns (the owner: gift-card balance and
   * top-up balance are the same thing), only what the member's history says.
   */
  creditWallet(id: string, fils: number, source: 'topup' | 'gift' | 'refund'): Promise<number>;
  /**
   * Grant points as ONE LOT with its own 12-month clock, and log the reason.
   * Returns the member's live balance afterwards.
   *
   * A grant NEVER renews an older lot — «ولا تتجدد بشراء جديد». A delta of 0
   * writes no lot (computeEarn returns 0 on a small invoice) but still logs, so
   * the history stays a complete ledger. A NEGATIVE delta throws: this method
   * had no sign guard, and one negative lot would poison every sum silently.
   */
  addPoints(id: string, delta: number, reasonAr: string, reasonEn: string): Promise<number>;
  /** Atomic points spend, OLDEST LOT FIRST, measured against the LIVE balance;
   *  throws conflict('insufficient_points') without touching a single lot. */
  spendPoints(id: string, points: number, reasonAr: string, reasonEn: string): Promise<number>;
  /**
   * Write the member's own details, and pay the completion bonus AT MOST ONCE.
   *
   * 🔴 THE GRANT DECISION IS HERE, NOT ON THE CLIENT. The phone may compute the
   * same answer with @almond/shared/loyalty/profile to render an accurate "+50"
   * before saving, but what it sends is a NAME — never a points figure and
   * never a claim of eligibility. `bonusGranted` in the reply is what actually
   * happened, and re-saving an unchanged name pays nothing while still
   * succeeding: editing your own profile twice is ordinary, not an error.
   */
  setProfile(
    id: string,
    profile: MemberProfile,
  ): Promise<{ profile: MemberProfile; bonusGranted: number; pointsBalance: number }>;
  /**
   * Record one qualifying purchase against the rolling window.
   *
   * Replaces `addSpend(id, jod)`, which was `m.windowSpend += jod`. The name
   * changed deliberately: the old one is banned by a source-level test
   * (bff/test/window.test.ts T23a, LOYALTY-ODOO-ARCHITECTURE §T23) so the
   * ever-accumulating defect cannot return under its original spelling.
   *
   * `occurredOn` is the AMMAN day key the sale happened on ('YYYY-MM-DD'); it
   * is the seam docs/LOYALTY-ODOO-ARCHITECTURE.md §B.2 specifies for a till
   * that reports late. Omitted, it is today in Amman — never the host's date.
   */
  recordSpend(id: string, jod: number, occurredOn?: string): Promise<void>;
  /** The member's rung, window spend, visit days and what is next. A READ: it
   *  must not mutate, so a promotion is visible before the write that
   *  materialises the floor (D11). */
  getStanding(id: string): Promise<TierStanding>;
  /** Close every evaluation period that has come due. Explicit, never a side
   *  effect of a read — the coupon hook, not a rate gate. */
  evaluateTier(id: string, at?: Date): Promise<Evaluation[]>;
  createOrder(o: NewOrder): Promise<OrderRecord>;
  /** Persist the earn breakdown on the order. NOT optional: without it a grant
   *  cannot be re-derived, the §5b shadow delta cannot be reconstructed, and
   *  D8's "make the total observable" goal is not met — a return value nothing
   *  writes down observes nothing. See LOYALTY-EARN-PATCH.md §3.5 row 2 / §5b. */
  recordEarnBreakdown(orderId: string, breakdown: EarnBreakdown): Promise<void>;
  getHistory(id: string): Promise<HistoryEntry[]>;
  // ---- The second-visit voucher (BRIEF §3 W2) ----
  /**
   * Evaluate the second-visit voucher for one transaction and persist whatever
   * row the decision produces. Returns the live voucher only when one was
   * ISSUED; null otherwise — and null deliberately covers "programme off",
   * "already evaluated", "ineligible", "declined" AND "suppressed (holdout)",
   * so no caller can tell the control arm from a member who was never eligible.
   *
   * 🔴 MUST be called BEFORE addPoints/recordSpend in the checkout saga.
   * memory.ts's must() hands back the STORED Member and addPoints mutates it in
   * place, so after the grant the pre-existing-balance guard would read a
   * post-grant balance, every new member would look like a migrated one, and
   * NOBODY would ever be issued a voucher — a silent total failure of the
   * mechanic. bff/test/secondVisit.test.ts T32a is what catches that.
   */
  evaluateSecondVisitVoucher(input: {
    memberId: string;
    orderId: string;
    basketHasDrink: boolean;
    /** The arm, derived from the member id (loyalty/holdout.ts). Never read
     *  from a request body. */
    arm: HoldoutStamp;
    at: Date;
  }): Promise<SecondVisitVoucher | null>;
  /** The member's row, or null. A COPY: `redeemedAt` is the double-spend guard
   *  and must not be reachable from outside the backend. */
  getSecondVisitVoucher(memberId: string): Promise<SecondVisitVoucher | null>;
  /** Atomic spend. Throws notFound (absent / suppressed / declined /
   *  ineligible — one identical answer for all four),
   *  conflict('voucher_already_redeemed'), conflict('voucher_expired'). */
  redeemSecondVisitVoucher(memberId: string, at: Date): Promise<SecondVisitVoucher>;
  // ---- Redemptions (loyalty/redemption.ts) ----
  /**
   * Spend points and mint the artifact the member actually presents.
   *
   * 🔴 THE POINTS ARE SPENT HERE, AT CREATION. That is what makes a
   * double-spend impossible and what keeps the balance honest the moment the
   * member acts. The other half of the bargain is `sweepRedemptions`: if this
   * code is never used, the points come back in full.
   */
  createRedemption(memberId: string, points: number): Promise<RedemptionRow>;
  /** By code, across all members — how the till resolves a code read aloud. */
  findRedemptionByCode(code: string): Promise<RedemptionRow | null>;
  /** The member's own live redemption, if any. */
  activeRedemption(memberId: string): Promise<RedemptionRow | null>;
  /**
   * Consume it, exactly once. Throws conflict('redemption_already_settled'),
   * conflict('redemption_expired'), conflict('redemption_cancelled') or
   * notFound — never returns a row it did not just settle.
   */
  settleRedemption(id: string, via: 'pos' | 'web', at: Date): Promise<RedemptionRow>;
  /** The member changed their mind. Points return immediately. */
  cancelRedemption(memberId: string, id: string, at: Date): Promise<RedemptionRow>;
  /**
   * Return the points of every expired, unused redemption, and say how many.
   *
   * Called on the member's own reads rather than by a cron, because the BFF has
   * none — the same lazy-settlement shape as point-lot expiry. A member who
   * never comes back is not refunded until they do, which costs them nothing:
   * the points are theirs either way and the balance is correct the instant it
   * is read.
   */
  sweepRedemptions(memberId: string, at: Date): Promise<number>;

  // ---- Corporate discounts (loyalty/corporate.ts) ----
  /** Every company, active or not. The back-office lists them all; only the
   *  active ones entitle anyone (`entitlementFor` enforces that). */
  listCompanies(): Promise<CompanyDiscount[]>;
  /** Create or replace one company by id. Validated with `companyError` at the
   *  route, so a 150% arrangement never reaches storage. */
  saveCompany(c: CompanyDiscount): Promise<CompanyDiscount>;
  /** Replace a company's roster wholesale and return how many are on it.
   *
   * REPLACE, not merge: an uploaded list is the company's current staff, and a
   * merge would leave last quarter's leavers holding a 50% card forever. The
   * previous roster is discarded, which is why the upload screen shows the
   * count before and after. */
  replaceRoster(companyId: string, entries: CorporateMemberEntry[]): Promise<number>;
  /** One company's roster, or the whole register when no id is given. */
  listRoster(companyId?: string): Promise<CorporateMemberEntry[]>;
  /** What this MEMBER is entitled to right now, resolved from their stored
   *  phone against the register. Null for everyone else.
   *
   * 🔴 RESOLVED SERVER-SIDE, FROM THE PHONE OTP PROVED. Never from a request
   * body: a client that could name its own company could award itself 50%. */
  entitlementFor(memberId: string): Promise<CorporateEntitlement | null>;
  /** Log a use of a standing discount, for the staff-drinks report. */
  recordCorporateUse(use: Omit<CorporateUse, 'id'>): Promise<CorporateUse>;
  /** Uses, newest first, optionally narrowed to one company or one member.
   *  This is what answers "which drink did each employee take, and how many
   *  times did they use their discount". */
  listCorporateUses(filter?: {
    companyId?: string; memberId?: string; from?: string; to?: string;
  }): Promise<CorporateUse[]>;

  // "Almond Club" subscription
  activateSubscription(id: string): Promise<SubscriptionState>;
  /** Use one of today's free drinks; throws conflict on not_subscribed/daily_cap. */
  redeemSubscriptionDrink(id: string): Promise<SubscriptionState>;
  getSubscription(id: string): Promise<SubscriptionState>;
}
