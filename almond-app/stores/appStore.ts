import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Lang } from '@/types';
import i18n, { applyRTL, LANG_STORAGE_KEY } from '@/lib/i18n';

interface AppState {
  lang: Lang;
  hasOnboarded: boolean;
  hydrated: boolean;
  setLang: (lang: Lang) => Promise<boolean>; // returns true if RTL direction flipped
  completeOnboarding: () => void;
  hydrate: () => Promise<void>;
}

const ONBOARDED_KEY = 'almond.onboarded';

export const useAppStore = create<AppState>((set, get) => ({
  lang: 'ar',
  hasOnboarded: false,
  hydrated: false,

  setLang: async (lang) => {
    await AsyncStorage.setItem(LANG_STORAGE_KEY, lang);
    await i18n.changeLanguage(lang);
    const flipped = applyRTL(lang);
    set({ lang });
    return flipped;
  },

  completeOnboarding: () => {
    AsyncStorage.setItem(ONBOARDED_KEY, '1').catch(() => {});
    set({ hasOnboarded: true });
  },

  hydrate: async () => {
    try {
      const [storedLang, onboarded] = await Promise.all([
        AsyncStorage.getItem(LANG_STORAGE_KEY),
        AsyncStorage.getItem(ONBOARDED_KEY),
      ]);
      const lang = (storedLang as Lang) ?? get().lang;
      await i18n.changeLanguage(lang);
      applyRTL(lang);
      set({ lang, hasOnboarded: onboarded === '1', hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));
