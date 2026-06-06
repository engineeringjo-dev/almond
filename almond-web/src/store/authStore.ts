'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  phone: string;
  name?: string;
}

interface AuthState {
  user: AuthUser | null;
  pendingPhone: string | null;
  /** Mock: remember the phone awaiting a code. Live: POST /auth/otp/request. */
  sendOtp: (phone: string) => void;
  /** Mock: accept any 4-digit code; derive a stable userId from the phone so the
   *  "same phone = same account" idea is demoable. Live: POST /auth/otp/verify. */
  verifyOtp: (code: string) => boolean;
  setName: (name: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      pendingPhone: null,
      sendOtp: (phone) => set({ pendingPhone: phone }),
      verifyOtp: (code) => {
        const phone = get().pendingPhone;
        if (!phone || !/^\d{4}$/.test(code.trim())) return false;
        const id = `u_${phone.replace(/\D/g, '')}`; // deterministic → shared account
        set({ user: { id, phone }, pendingPhone: null });
        return true;
      },
      setName: (name) => set((s) => (s.user ? { user: { ...s.user, name } } : s)),
      logout: () => set({ user: null, pendingPhone: null }),
    }),
    {
      name: 'almond-auth',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : (undefined as never),
      ),
    },
  ),
);
