import { create } from 'zustand';

/**
 * Lightweight "added to cart" confirmation (Order Experience Engineering Spec
 * §2.5 / §4.2). Triggered from cartStore.addItem; rendered by <CartToast>.
 */
interface ToastState {
  visible: boolean;
  itemId: string;
  nameAr: string;
  nameEn: string;
  seq: number;
  showAdded: (p: { itemId: string; nameAr: string; nameEn: string }) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  visible: false,
  itemId: '',
  nameAr: '',
  nameEn: '',
  seq: 0,
  showAdded: (p) => set((s) => ({ visible: true, ...p, seq: s.seq + 1 })),
  hide: () => set({ visible: false }),
}));
