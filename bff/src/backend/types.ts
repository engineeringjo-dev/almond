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

/**
 * What a claim on an Idempotency-Key found.
 *
 *   claimed   nobody holds this key (or its holder expired): run the request.
 *   pending   a request holding it has not finished — or its process died
 *             before it could say how it ended. NEVER re-run: it may already
 *             have moved money, and "did it?" is exactly what nobody knows.
 *   mismatch  the key was used for a DIFFERENT request (method, route or body).
 *             Replaying the first one's answer to the second would tell the
 *             client something happened that it never asked for.
 *   done      finished: replay the stored answer, byte for byte.
 */
export type IdempotencyClaim =
  | { state: 'claimed' }
  | { state: 'pending' }
  | { state: 'mismatch' }
  | { state: 'done'; statusCode: number; body: string };

/**
 * One checkout, already priced — handed to `Backend.checkout` whole.
 *
 * Every number here was computed by the ROUTE through @almond/shared (reprice,
 * computeEarn, the funding gate). The backend does no pricing and no earn
 * arithmetic of its own: it only moves what it is told to move, and moves all
 * of it or none of it.
 */
export interface CheckoutInput {
  order: Omit<NewOrder, 'memberId' | 'pointsEarned'>;
  /** Fils to take from the wallet, oldest lot first. 0 unless paid from it. */
  walletDebitFils: number;
  /** The grant, already through the `funded` gate (0 on an unfunded order).
   *  Logged even at 0, exactly as addPoints always has. */
  pointsEarned: number;
  pointsReasonAr: string;
  pointsReasonEn: string;
  /** The earn breakdown to persist on the order, or null when nothing was
   *  granted — a breakdown describes a grant, and there was not one. */
  earn: EarnBreakdown | null;
  /** JOD to record into the rolling window, or null (unfunded: no window). */
  spendJod: number | null;
  /** The standing discount that applied, or null. `phone` and `orderId` are
   *  filled in by the backend from the locked member row and the new order. */
  corporateUse: Omit<CorporateUse, 'id' | 'memberId' | 'phone' | 'orderId' | 'at'> | null;
  /** The voucher's inputs. The arm is derived from the member id by the route,
   *  never read from a request body. */
  secondVisit: { basketHasDrink: boolean; arm: HoldoutStamp };
  /** ONE instant for the whole checkout: the order, the ledger lines, the
   *  voucher's 30-day clock and the corporate use are all stamped with it. */
  at: Date;
  /**
   * The captured card payment this order spends, or absent/null (wallet, cash).
   * Consumed INSIDE the transaction: the intent is locked, checked, and bound
   * to the new order — so two orders cannot spend one payment, and a refused
   * checkout leaves the payment unspent.
   */
  payment?: CheckoutPayment | null;
}

/**
 * ONE SALE A TILL REPORTED — the row behind POST /v1/pos/earn, keyed by the POS
 * order's own reference (Odoo `pos.order.name`, e.g. "Shop/0042").
 *
 * 🔴 THE KEY IS THE POS ORDER, NOT A CLIENT-GENERATED IDEMPOTENCY KEY. A till
 * retries: the network drops, the Odoo queue re-sends, a cashier presses the
 * button twice. Every one of those carries the same order reference, so the
 * reference IS the idempotency key — durable (a row), cross-instance (the
 * primary key) and meaningful to the back-office (it matches the receipt).
 */
export interface TillSale {
  posOrderRef: string;
  memberId: string;
  branchId: string;
  /** What the till collected in MONEY, tax-inclusive, in fils. */
  paidFils: number;
  /** ISO instant of the payment, as the till reported it (or the server's clock). */
  paidAt: string;
  /** The Amman day the window spend was recorded on — null when none was
   *  (a sale paid entirely with points). Needed to take the spend back out on
   *  a reversal. */
  spendDay: string | null;
  pointsEarned: number;
  /** The member's live balance right after the grant — what a replay returns. */
  pointsBalanceAfter: number;
  /** The breakdown the grant was computed from (§5b), or null for a 0 grant
   *  that had none (never for a real grant). */
  earn: EarnBreakdown | null;
  status: 'earned' | 'reversed';
  /** Filled only once reversed. `reversedPoints + shortfall === pointsEarned`. */
  reversedPoints: number | null;
  shortfall: number | null;
  reverseBalanceAfter: number | null;
  reverseReason: string | null;
  reversedAt: string | null;
  createdAt: string;
}

/** A till's report that it took the money for one sale — already priced by
 *  the route through @almond/shared. The backend only moves it. */
export interface TillEarnInput {
  posOrderRef: string;
  /** From the VERIFIED earn ticket — never from the request body. */
  memberId: string;
  /** The ticket's id: single use, enforced by the store (UNIQUE). */
  ticketJti: string;
  /** Why the ticket may not START a new sale — expired, or the sale was paid
   *  too far from the scan (routes/pos.ts) — or null. Decided by the route; a
   *  REPLAY of a sale the ticket already paid for ignores it, so a till's
   *  delayed retry still gets its answer. */
  ticketRefusal: 'expired' | 'paid_outside_window' | null;
  branchId: string;
  paidFils: number;
  paidAt: Date;
  /** Computed by computeEarn in the route (0 for a corporate member). */
  pointsEarned: number;
  earn: EarnBreakdown | null;
  /** JOD into the rolling window (the money actually collected), or null. */
  spendJod: number | null;
  /** Amman day key the spend is dated on (the day of `paidAt`). */
  spendDay: string | null;
  reasonAr: string;
  reasonEn: string;
  at: Date;
}

export interface TillEarnResult { sale: TillSale; replay: boolean }

/**
 * A card payment the member started — the row behind POST /v1/payments/intent
 * and the ONLY thing that can make a card order `funded`.
 *
 * `cartHash` binds it to one basket and `amountFils` to that basket's re-priced
 * total, so a payment captured for a coffee cannot be presented against a
 * banquet. `orderId` binds it to the one order it paid for, under a UNIQUE
 * constraint: a captured payment is spent exactly once.
 */
export interface PaymentIntent {
  id: string;
  memberId: string;
  amountFils: number;
  currency: 'JOD';
  cartHash: string;
  /** PaymentProvider.name that created it. A payment is only ever confirmed by
   *  the provider that took it. */
  provider: string;
  providerRef: string;
  status: 'pending' | 'captured' | 'failed';
  captureRef: string | null;
  orderId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What Backend.checkout needs to spend a captured intent inside its one
 *  transaction. Every field was checked by the route against the provider;
 *  the backend re-checks what the database knows (owner, amount, basket,
 *  unused) under the row lock. */
export interface CheckoutPayment {
  intentId: string;
  amountFils: number;
  cartHash: string;
  captureRef: string | null;
}

export interface CheckoutResult {
  order: OrderRecord;
  pointsBalance: number;
  walletBalanceFils: number;
  /** Only an ISSUED voucher — null for every other outcome, as ever. */
  secondVisitVoucher: SecondVisitVoucher | null;
  /** Why the voucher step failed, if it did. It never fails the checkout: a
   *  marketing grant must not roll back a paid order. The route logs it. */
  secondVisitError: unknown;
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

  // ---- Composite money movements: ONE transaction each ----
  /**
   * Debit the wallet, write the order, evaluate the second-visit voucher, log
   * the corporate use, grant the points and record the window spend — as ONE
   * atomic unit.
   *
   * 🔴 THIS REPLACED A SAGA. debitWallet, createOrder and addPoints used to be
   * three transactions stitched together by the route, and the compensating
   * refund ran only on a thrown error. A process that died after the debit —
   * a deploy, an OOM — kept the member's money and wrote no order. Now either
   * every row lands or none does; there is nothing left to compensate.
   *
   * Throws conflict('insufficient_wallet') and conflict('negative_grant')
   * having written nothing.
   */
  checkout(memberId: string, input: CheckoutInput): Promise<CheckoutResult>;
  /** Debit the wallet (when `walletDebitFils` > 0) and activate the
   *  subscription in ONE transaction — the same fix as `checkout`. */
  purchaseSubscription(
    id: string, walletDebitFils: number,
  ): Promise<{ subscription: SubscriptionState; walletBalanceFils: number }>;
  /** Credit a top-up lot and grant its reload bonus in ONE transaction. A
   *  bonus of 0 writes no points line, as the route always behaved. */
  topUpWallet(
    id: string, fils: number, bonusPoints: number, reasonAr: string, reasonEn: string,
  ): Promise<{ walletBalanceFils: number; pointsBalance: number }>;

  // ---- The till's earn (POST /v1/pos/earn) ----
  /**
   * Grant the points for one sale a till took the money for — ONE transaction
   * holding the member lock: the grant, its ledger line, the window spend and
   * the pos_sales row land together or not at all.
   *
   * Idempotent by `posOrderRef`: the same reference again returns the stored
   * sale with `replay: true` and grants nothing. The same reference with a
   * different member, amount or branch throws conflict('pos_order_conflict').
   * A ticket already spent on another sale throws conflict('earn_ticket_used');
   * an expired one starting a NEW sale throws 401 'earn_ticket_expired'.
   */
  tillEarn(input: TillEarnInput): Promise<TillEarnResult>;
  /**
   * Take back what a refunded or voided POS order granted — once. Never drives
   * the balance negative: what the member already spent is reported as
   * `shortfall`, not clawed. A second call returns the stored reversal with
   * `replay: true`. notFound for an unknown reference.
   */
  reverseTillEarn(posOrderRef: string, reason: string, at: Date): Promise<TillEarnResult>;
  /** The sale a till reported, or null. */
  getTillSale(posOrderRef: string): Promise<TillSale | null>;

  // ---- Card payments (bff/src/payments) ----
  /** Store a new intent (status `pending`). */
  createPaymentIntent(intent: Omit<PaymentIntent, 'status' | 'captureRef' | 'orderId' | 'createdAt' | 'updatedAt'>, at: Date): Promise<PaymentIntent>;
  getPaymentIntent(id: string): Promise<PaymentIntent | null>;
  /**
   * A verified provider webhook: move a PENDING intent to `captured` or
   * `failed`. A captured intent is never un-captured by a later webhook, and a
   * spent one is never touched. Returns the intent after, or null when no
   * intent carries that provider reference.
   */
  recordPaymentStatus(provider: string, providerRef: string, status: 'captured' | 'failed', at: Date): Promise<PaymentIntent | null>;

  // ---- Idempotency-Key store (plugins/idempotency.ts) ----
  /**
   * Claim `key` for this member and request. Durable in the store itself, so
   * a retry after a restart — or on another instance — sees the first attempt.
   *
   * 🔴 THE KEYS USED TO LIVE IN A PER-PROCESS Map. The money was durable and
   * the memory of which request had already moved it was not: redeem with key
   * K, restart, retry K, and the points were spent twice and a second code
   * minted (bff/test/resilience-restart.test.ts R2.6).
   *
   * `at` is the caller's clock, so expiry (24 h) is judged identically by both
   * implementations and by a test that moves time.
   */
  claimIdempotencyKey(memberId: string, key: string, requestHash: string, at: Date): Promise<IdempotencyClaim>;
  /** Record the answer to replay. Only a PENDING claim with the same hash is
   *  completed — never someone else's. */
  completeIdempotencyKey(
    memberId: string, key: string, requestHash: string, statusCode: number, body: string,
  ): Promise<void>;
  /** Drop a PENDING claim so the request may be retried (a 5xx that moved
   *  nothing). A completed key is never released. */
  releaseIdempotencyKey(memberId: string, key: string, requestHash: string): Promise<void>;

  // "Almond Club" subscription
  activateSubscription(id: string): Promise<SubscriptionState>;
  /** Use one of today's free drinks; throws conflict on not_subscribed/daily_cap. */
  redeemSubscriptionDrink(id: string): Promise<SubscriptionState>;
  getSubscription(id: string): Promise<SubscriptionState>;
}
