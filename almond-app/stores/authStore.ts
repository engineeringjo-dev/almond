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
const GUEST: User = { id: 'guest', phone: '', name: 'ضيف', isGuest: true };

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

/** The effective user id for service calls (guest uses a stable demo id). */
export function useUserId(): string {
  return useAuthStore((s) => s.user?.id ?? 'guest');
}
