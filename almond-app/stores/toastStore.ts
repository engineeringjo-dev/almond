import { create } from 'zustand';

/**
 * Lightweight cart/checkout toast (Order Experience Engineering Spec §2.5/§4.2).
 * `showAdded` is triggered from cartStore.addItem; `showError` surfaces a
 * checkout/payment failure so it is never silent. Rendered by <CartToast>.
 */
interface ToastState {
  visible: boolean;
  kind: 'added' | 'error';
  itemId: string;
  nameAr: string;
  nameEn: string;
  message: string;
  seq: number;
  showAdded: (p: { itemId: string; nameAr: string; nameEn: string }) => void;
  showError: (message: string) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  visible: false,
  kind: 'added',
  itemId: '',
  nameAr: '',
  nameEn: '',
  message: '',
  seq: 0,
  showAdded: (p) => set((s) => ({ visible: true, kind: 'added', ...p, seq: s.seq + 1 })),
  showError: (message) => set((s) => ({ visible: true, kind: 'error', message, seq: s.seq + 1 })),
  hide: () => set({ visible: false }),
}));
