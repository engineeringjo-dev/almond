import type { OrderType, PaymentMethodId } from '@almond/shared/types';

export interface Member {
  id: string;
  phone: string;
  name: string;
  points: number;
  walletFils: number; // stored-value wallet, in fils
  windowSpend: number; // rolling spend (JOD) → tier
  lastEarnAt: number;
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
  getHistory(id: string): Promise<HistoryEntry[]>;
}
