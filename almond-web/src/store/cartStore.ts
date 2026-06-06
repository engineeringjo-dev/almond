'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  CartItem,
  CartCustomization,
  ItemSize,
  MenuItem,
  OrderType,
  PaymentMethodId,
} from '@almond/shared/types';
import { buildLineId } from '@almond/shared/cart';

interface CartState {
  items: CartItem[];
  // Order context (used by checkout) — mirrors the app's cart store.
  orderType: OrderType;
  branchId: string | null;
  paymentMethod: PaymentMethodId;
  paidFromBalance: boolean;
  promoCode: string | null;
  promoDiscount: number;
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

/**
 * Website cart — mirrors the app's store. Line ids + pricing come from
 * @almond/shared/cart so a basket totals identically across web and app.
 * Persisted to localStorage so it survives navigation/reload.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      orderType: 'pickup',
      branchId: null,
      paymentMethod: 'cash',
      paidFromBalance: false,
      promoCode: null,
      promoDiscount: 0,
      curbside: false,
      carInfo: '',

      addItem: (item, size, customizations, qty) =>
        set((state) => {
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
        }),

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
          items: state.items.map((l) =>
            l.lineId === lineId ? { ...l, qty: l.qty + 1 } : l,
          ),
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
        set({
          items: [],
          promoCode: null,
          promoDiscount: 0,
          paidFromBalance: false,
          curbside: false,
          carInfo: '',
        }),
    }),
    {
      name: 'almond-cart',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : (undefined as never),
      ),
    },
  ),
);

/** Total item count (sum of quantities). */
export const useCartCount = () =>
  useCartStore((s) => s.items.reduce((sum, l) => sum + l.qty, 0));
