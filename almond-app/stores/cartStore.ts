import { create } from 'zustand';

import type {
  CartItem,
  MenuItem,
  ItemSize,
  CartCustomization,
  OrderType,
  PaymentMethodId,
} from '@/types';
import { config } from '@/constants/config';
import { useToastStore } from './toastStore';

interface CartState {
  items: CartItem[];
  orderType: OrderType;
  branchId: string | null;
  paymentMethod: PaymentMethodId;
  paidFromBalance: boolean;
  promoCode: string | null;
  promoDiscount: number;
  /** Curbside pickup: bring the order to the car (Starbucks Curbside). */
  curbside: boolean;
  carInfo: string;

  addItem: (
    item: MenuItem,
    size: ItemSize,
    customizations: CartCustomization[],
    qty: number,
  ) => void;
  addLine: (line: CartItem) => void;
  incLine: (lineId: string) => void;
  decLine: (lineId: string) => void;
  removeLine: (lineId: string) => void;
  setOrderType: (t: OrderType) => void;
  setBranch: (id: string) => void;
  setPaymentMethod: (m: PaymentMethodId) => void;
  setPromo: (code: string | null, discount: number) => void;
  setCurbside: (on: boolean) => void;
  setCarInfo: (info: string) => void;
  clear: () => void;
}

/** Build a stable line id from item + size + sorted customization option ids. */
function buildLineId(itemId: string, sizeId: string, custs: CartCustomization[]): string {
  const sig = custs
    .map((c) => `${c.groupId}:${c.optionId}`)
    .sort()
    .join('|');
  return `${itemId}__${sizeId}__${sig}`;
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  orderType: 'pickup',
  branchId: null,
  paymentMethod: 'cash',
  paidFromBalance: false,
  promoCode: null,
  promoDiscount: 0,
  curbside: false,
  carInfo: '',

  addItem: (item, size, customizations, qty) => {
    // Visual "added to cart" confirmation (Spec §4.2).
    useToastStore.getState().showAdded({ itemId: item.id, nameAr: item.nameAr, nameEn: item.nameEn });
    return set((state) => {
      const lineId = buildLineId(item.id, size.id, customizations);
      const existing = state.items.find((l) => l.lineId === lineId);
      if (existing) {
        return {
          items: state.items.map((l) =>
            l.lineId === lineId ? { ...l, qty: l.qty + qty } : l,
          ),
        };
      }
      const line: CartItem = {
        lineId,
        itemId: item.id,
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        emoji: item.emoji,
        sizeId: size.id,
        sizeNameAr: size.nameAr,
        sizeNameEn: size.nameEn,
        unitBasePrice: size.price,
        customizations,
        qty,
        isBrunch: item.isBrunch,
        isDrink: item.isDrink,
        prepMinutes: item.prepMinutes,
      };
      return { items: [...state.items, line] };
    });
  },

  addLine: (line) =>
    set((state) => {
      const existing = state.items.find((l) => l.lineId === line.lineId);
      if (existing) {
        return {
          items: state.items.map((l) =>
            l.lineId === line.lineId ? { ...l, qty: l.qty + line.qty } : l,
          ),
        };
      }
      return { items: [...state.items, line] };
    }),

  incLine: (lineId) =>
    set((state) => ({
      items: state.items.map((l) => (l.lineId === lineId ? { ...l, qty: l.qty + 1 } : l)),
    })),

  decLine: (lineId) =>
    set((state) => ({
      items: state.items
        .map((l) => (l.lineId === lineId ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0),
    })),

  removeLine: (lineId) =>
    set((state) => ({ items: state.items.filter((l) => l.lineId !== lineId) })),

  setOrderType: (orderType) => set({ orderType }),
  setBranch: (branchId) => set({ branchId }),
  setPaymentMethod: (paymentMethod) =>
    set({ paymentMethod, paidFromBalance: paymentMethod === 'wallet' }),
  setPromo: (promoCode, promoDiscount) => set({ promoCode, promoDiscount }),
  setCurbside: (curbside) => set({ curbside }),
  setCarInfo: (carInfo) => set({ carInfo }),
  clear: () =>
    set({ items: [], promoCode: null, promoDiscount: 0, paidFromBalance: false, curbside: false, carInfo: '' }),
}));

/** Total item count for the cart tab badge. */
export function useCartCount(): number {
  return useCartStore((s) => s.items.reduce((sum, l) => sum + l.qty, 0));
}

/** Unit price for a line including customization deltas. */
export function lineUnitPrice(line: CartItem): number {
  const extras = line.customizations.reduce((s, c) => s + c.priceDelta, 0);
  return line.unitBasePrice + extras;
}

/**
 * Compute cart pricing + tax (sections 4.6, 5).
 * Note: the drink+food combo is now a POINTS bonus (see lib/combo.ts), not a
 * price discount, so it does not affect the cart total here.
 */
export interface CartTotals {
  subtotal: number;
  promoDiscount: number;
  discount: number;
  tax: number;
  total: number;
}

export function computeTotals(
  items: CartItem[],
  promoDiscount: number,
): CartTotals {
  const subtotal = items.reduce((sum, l) => sum + lineUnitPrice(l) * l.qty, 0);
  const discount = promoDiscount;

  const taxable = Math.max(0, subtotal - discount);
  const tax = taxable * config.TAX_RATE;
  const total = taxable + tax;
  return {
    subtotal,
    promoDiscount,
    discount,
    tax,
    total,
  };
}
