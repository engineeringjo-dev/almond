import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  CartItem,
  MenuItem,
  ItemSize,
  CartCustomization,
  OrderType,
  PaymentMethodId,
} from '@/types';
import { buildLineId } from '@almond/shared/cart';
import { useToastStore } from './toastStore';
import { branchRef, type BranchNames, type BranchRef, type BranchSwitch } from '@/lib/cartBranch';

// Cart pricing is the single source of truth in @almond/shared/cart (so app +
// website total identically). Re-exported so existing @/stores/cartStore
// importers (computeTotals, lineUnitPrice, CartTotals) keep working unchanged.
export { lineUnitPrice, computeTotals } from '@almond/shared/cart';
export type { CartTotals } from '@almond/shared/cart';

interface CartState {
  items: CartItem[];
  orderType: OrderType;
  branchId: string | null;
  /** The chosen branch's name, kept so it can still be named after it leaves
   *  the branch list (the switch notice says WHICH branch went away). */
  branchNames: BranchNames | null;
  /** Chosen in this session — not restored from storage (never persisted). */
  branchPinned: boolean;
  /** The cart moved the order off the chosen branch; shown until dismissed or
   *  a branch is chosen. Session-only. */
  branchNotice: BranchSwitch | null;
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
  /** The customer chose a branch: it is theirs, even if it is closed now. */
  setBranch: (branch: BranchRef) => void;
  /** The cart moved the order to another branch, and says why. */
  switchBranch: (notice: BranchSwitch) => void;
  dismissBranchNotice: () => void;
  setPaymentMethod: (m: PaymentMethodId) => void;
  setPromo: (code: string | null, discount: number) => void;
  setCurbside: (on: boolean) => void;
  setCarInfo: (info: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
  items: [],
  orderType: 'pickup',
  branchId: null,
  branchNames: null,
  branchPinned: false,
  branchNotice: null,
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
  setBranch: (branch) =>
    set({
      branchId: branch.id,
      branchNames: { nameAr: branch.nameAr, nameEn: branch.nameEn },
      branchPinned: true,
      branchNotice: null,
    }),
  switchBranch: (notice) => {
    const to = branchRef(notice.to);
    set({
      branchId: to.id,
      branchNames: { nameAr: to.nameAr, nameEn: to.nameEn },
      branchPinned: false,
      branchNotice: notice,
    });
  },
  dismissBranchNotice: () => set({ branchNotice: null }),
  setPaymentMethod: (paymentMethod) =>
    set({ paymentMethod, paidFromBalance: paymentMethod === 'wallet' }),
  setPromo: (promoCode, promoDiscount) => set({ promoCode, promoDiscount }),
  setCurbside: (curbside) => set({ curbside }),
  setCarInfo: (carInfo) => set({ carInfo }),
  clear: () =>
    set({ items: [], promoCode: null, promoDiscount: 0, paidFromBalance: false, curbside: false, carInfo: '' }),
    }),
    {
      // Persist the cart so a browser refresh / app close never empties it.
      // Promo code/discount are intentionally NOT persisted (re-applied fresh
      // against the live subtotal to avoid a stale frozen discount).
      name: 'almond.cart',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        items: s.items,
        orderType: s.orderType,
        branchId: s.branchId,
        branchNames: s.branchNames,
        paymentMethod: s.paymentMethod,
        paidFromBalance: s.paidFromBalance,
        curbside: s.curbside,
        carInfo: s.carInfo,
      }),
    },
  ),
);

/** Total item count for the cart tab badge. */
export function useCartCount(): number {
  return useCartStore((s) => s.items.reduce((sum, l) => sum + l.qty, 0));
}
