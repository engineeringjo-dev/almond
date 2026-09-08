import type { OrderType, PaymentMethodId, TierId } from '@almond/shared/types';
import type { EarnBreakdown } from '@almond/shared/loyalty/earn';
import type { HoldoutStamp } from '@almond/shared/loyalty/holdout';
import type { SecondVisitVoucher } from '@almond/shared/loyalty/secondVisit';
import type { SpendEntry, TierStanding, Evaluation } from '@almond/shared/loyalty/window';

export interface Member {
  id: string;
  phone: string;
  name: string;
  points: number;
  walletFils: number; // stored-value wallet, in fils
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
  lastEarnAt: number;
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
   *  written before this field existed stay valid. */
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
export interface Backend {
  findOrCreateByPhone(phone: string, name?: string): Promise<Member>;
  getMember(id: string): Promise<Member>;
  /** Atomic debit; throws conflict('insufficient_wallet') if balance < fils. */
  debitWallet(id: string, fils: number): Promise<number>;
  creditWallet(id: string, fils: number): Promise<number>;
  addPoints(id: string, delta: number, reasonAr: string, reasonEn: string): Promise<number>;
  /** Atomic points spend; throws conflict('insufficient_points'). */
  spendPoints(id: string, points: number, reasonAr: string, reasonEn: string): Promise<number>;
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
  // "Almond Club" subscription
  activateSubscription(id: string): Promise<SubscriptionState>;
  /** Use one of today's free drinks; throws conflict on not_subscribed/daily_cap. */
  redeemSubscriptionDrink(id: string): Promise<SubscriptionState>;
  getSubscription(id: string): Promise<SubscriptionState>;
}
