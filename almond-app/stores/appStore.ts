import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Lang } from '@/types';
import i18n, { applyRTL, LANG_STORAGE_KEY } from '@/lib/i18n';

interface AppState {
  lang: Lang;
  hasOnboarded: boolean;
  hydrated: boolean;
  /** Open «اجمع نقاطك» by itself on launch (lib/earnSheet.ts). On unless the
   *  member switched it off; a device setting, so it is not sent anywhere. */
  autoEarnQr: boolean;
  setAutoEarnQr: (on: boolean) => void;
  /** The last visit the thank-you sheet was SHOWN for ("order:…" / "pos:…").
   *  Once shown — rated or waved away — a visit is not asked about again on
   *  this device (lib/launchSheet.ts). */
  lastVisitPrompt: string | null;
  setLastVisitPrompt: (ref: string) => void;
  setLang: (lang: Lang) => Promise<boolean>; // returns true if RTL direction flipped
  completeOnboarding: () => void;
  hydrate: () => Promise<void>;
}

const ONBOARDED_KEY = 'almond.onboarded';
const AUTO_EARN_QR_KEY = 'almond.autoEarnQr';
const LAST_VISIT_PROMPT_KEY = 'almond.lastVisitPrompt';

export const useAppStore = create<AppState>((set, get) => ({
  lang: 'ar',
  hasOnboarded: false,
  hydrated: false,
  autoEarnQr: true,
  lastVisitPrompt: null,

  setAutoEarnQr: (on) => {
    AsyncStorage.setItem(AUTO_EARN_QR_KEY, on ? '1' : '0').catch(() => {});
    set({ autoEarnQr: on });
  },

  setLastVisitPrompt: (ref) => {
    AsyncStorage.setItem(LAST_VISIT_PROMPT_KEY, ref).catch(() => {});
    set({ lastVisitPrompt: ref });
  },

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
      const [storedLang, onboarded, autoEarnQr, lastVisitPrompt] = await Promise.all([
        AsyncStorage.getItem(LANG_STORAGE_KEY),
        AsyncStorage.getItem(ONBOARDED_KEY),
        AsyncStorage.getItem(AUTO_EARN_QR_KEY),
        AsyncStorage.getItem(LAST_VISIT_PROMPT_KEY),
      ]);
      const lang = (storedLang as Lang) ?? get().lang;
      await i18n.changeLanguage(lang);
      applyRTL(lang);
      set({
        lang, hasOnboarded: onboarded === '1', autoEarnQr: autoEarnQr !== '0',
        lastVisitPrompt: lastVisitPrompt || null, hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },
}));
