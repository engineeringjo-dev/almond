import type { OrderType, PaymentMethodId } from '@almond/shared/types';
import type { EarnBreakdown } from '@almond/shared/loyalty/earn';

export interface Member {
  id: string;
  phone: string;
  name: string;
  points: number;
  walletFils: number; // stored-value wallet, in fils
  windowSpend: number; // rolling spend (JOD) → tier
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
  addSpend(id: string, jod: number): Promise<void>;
  createOrder(o: NewOrder): Promise<OrderRecord>;
  /** Persist the earn breakdown on the order. NOT optional: without it a grant
   *  cannot be re-derived, the §5b shadow delta cannot be reconstructed, and
   *  D8's "make the total observable" goal is not met — a return value nothing
   *  writes down observes nothing. See LOYALTY-EARN-PATCH.md §3.5 row 2 / §5b. */
  recordEarnBreakdown(orderId: string, breakdown: EarnBreakdown): Promise<void>;
  getHistory(id: string): Promise<HistoryEntry[]>;
  // "Almond Club" subscription
  activateSubscription(id: string): Promise<SubscriptionState>;
  /** Use one of today's free drinks; throws conflict on not_subscribed/daily_cap. */
  redeemSubscriptionDrink(id: string): Promise<SubscriptionState>;
  getSubscription(id: string): Promise<SubscriptionState>;
}
