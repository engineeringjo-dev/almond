import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { User } from '@/types';

interface AuthState {
  user: User | null;
  hydrated: boolean;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  continueAsGuest: () => void;
  logout: () => void;
  hydrate: () => Promise<void>;
}

const USER_KEY = 'almond.user';
// `name: ''` for the same reason as auth.service.ts: the word for "guest" is
// language-dependent, so it lives in the locale files (`home.guest`) and is
// resolved at render time. Storing 'ضيف' here put one language's word into
// state that both languages read.
const GUEST: User = { id: 'guest', phone: '', name: '', isGuest: true };

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  isAuthenticated: false,

  setUser: (user) => {
    AsyncStorage.setItem(USER_KEY, JSON.stringify(user)).catch(() => {});
    set({ user, isAuthenticated: !user.isGuest });
  },

  continueAsGuest: () => set({ user: GUEST, isAuthenticated: false }),

  logout: () => {
    AsyncStorage.removeItem(USER_KEY).catch(() => {});
    set({ user: null, isAuthenticated: false });
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(USER_KEY);
      if (raw) {
        const user = JSON.parse(raw) as User;
        set({ user, isAuthenticated: !user.isGuest, hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },
}));

/** The signed-in user, or null. A selector rather than `useAuthStore(s => s.user)`
 *  at each call site so the subscription shape is the same everywhere. */
export function useUser(): User | null {
  return useAuthStore((s) => s.user);
}

/** The effective user id for service calls (guest uses a stable demo id). */
export function useUserId(): string {
  return useAuthStore((s) => s.user?.id ?? 'guest');
}
