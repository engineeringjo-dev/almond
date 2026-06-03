import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { bonusDayKey } from '@/lib/bonusDay';

/**
 * Remembers that the member "Activated" today's Double Beans Day (SB-style
 * activatable promo). Persisted locally; keyed by the calendar day.
 */
interface PromoState {
  activatedDate: string;
  hydrated: boolean;
  activate: () => void;
  isActivatedToday: () => boolean;
  hydrate: () => Promise<void>;
}

const KEY = 'almond.bonusDayActivated';

export const usePromoStore = create<PromoState>((set, get) => ({
  activatedDate: '',
  hydrated: false,

  activate: () => {
    const today = bonusDayKey();
    AsyncStorage.setItem(KEY, today).catch(() => {});
    set({ activatedDate: today });
  },

  isActivatedToday: () => get().activatedDate === bonusDayKey(),

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      set({ activatedDate: raw ?? '', hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));
