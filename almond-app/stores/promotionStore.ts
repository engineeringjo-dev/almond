import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  NO_PROMOTION_RECORD,
  dismissPromotion,
  observeRung,
  parsePromotion,
  serialisePromotion,
  type PromotionRecord,
} from '@/lib/promotion';

/**
 * WHERE "the last rung the member was shown" LIVES.
 *
 * Same shape as promoStore (a single AsyncStorage key, hydrated once at app
 * start) and for the same reason: it is a fact about what this device has
 * displayed, not about what the member is owed. The reasoning for keeping it
 * off the server, and the two failure modes that buys, are in lib/promotion.ts.
 *
 * Every decision in here is `observeRung` / `dismissPromotion` / `parsePromotion`,
 * which are pure and tested. What this file adds is exactly three things a pure
 * function cannot hold: the disk, the current member, and the hydration gate.
 */
interface PromotionState {
  /** The member the in-memory record belongs to; '' before hydration. */
  userId: string;
  record: PromotionRecord;
  /** 🔴 Nothing may be decided before the disk has been read — see observe(). */
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** Fold in the rung the member is PAID at (`LoyaltyBalance.tier`). */
  observe: (userId: string, rungId: string) => void;
  dismiss: () => void;
}

const KEY = 'almond.promotionSeen';

export const usePromotionStore = create<PromotionState>((set, get) => ({
  userId: '',
  record: NO_PROMOTION_RECORD,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      // The stored blob carries its own userId. It is matched against the
      // ASKING member in observe() rather than here, because this runs at app
      // start, before authStore has necessarily finished hydrating.
      const userId = raw ? readUserId(raw) : '';
      set({ userId, record: parsePromotion(raw, userId), hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  observe: (userId, rungId) => {
    // 🔴 THE HYDRATION GATE. On a cold start the balance query can resolve
    // before AsyncStorage does. Folding an observation into the empty
    // in-memory record would BASELINE over a real one — and a baseline never
    // celebrates, so the effect would be to swallow exactly the promotion this
    // whole package exists to show, silently, on the launch that should have
    // shown it.
    if (!get().hydrated) return;
    if (!userId) return;

    const state = get();
    // A different member on the same handset: baseline them, never inherit.
    const base = state.userId === userId ? state.record : NO_PROMOTION_RECORD;
    const next = observeRung(base, rungId);
    if (next === base && state.userId === userId) return;

    set({ userId, record: next });
    AsyncStorage.setItem(KEY, serialisePromotion(userId, next)).catch(() => {});
  },

  dismiss: () => {
    const { userId, record } = get();
    const next = dismissPromotion(record);
    if (next === record) return;
    set({ record: next });
    if (userId) AsyncStorage.setItem(KEY, serialisePromotion(userId, next)).catch(() => {});
  },
}));

/** The member the blob on disk belongs to, or '' if it is unreadable. Kept
 *  local: nothing outside this file may treat a stored id as an identity. */
function readUserId(raw: string): string {
  try {
    const v = JSON.parse(raw) as { userId?: unknown } | null;
    return v && typeof v.userId === 'string' ? v.userId : '';
  } catch {
    return '';
  }
}
