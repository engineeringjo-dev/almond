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
  clear: () =>
    set({ items: [], promoCode: null, promoDiscount: 0, paidFromBalance: false }),
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

/** Compute cart pricing including brunch combo + tax (sections 4.6, 5). */
export interface CartTotals {
  subtotal: number;
  brunchDiscount: number;
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

  // Brunch combo: one BR food per drink → -1.000 JOD each (section 5).
  const drinkQty = items.filter((l) => l.isDrink).reduce((s, l) => s + l.qty, 0);
  const brunchQty = items.filter((l) => l.isBrunch).reduce((s, l) => s + l.qty, 0);
  const combos = Math.min(drinkQty, brunchQty);
  const brunchDiscount = combos * config.BRUNCH_COMBO_DISCOUNT;

  // Discount stacking OFF (section 2.4): take the larger of brunch vs promo.
  const discount = Math.max(brunchDiscount, promoDiscount);

  const taxable = Math.max(0, subtotal - discount);
  const tax = taxable * config.TAX_RATE;
  const total = taxable + tax;
  return {
    subtotal,
    brunchDiscount,
    promoDiscount,
    discount,
    tax,
    total,
  };
}
