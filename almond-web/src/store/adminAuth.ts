'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Mock admin gate. Replace with the real OTP/SSO auth seam (see docs) — under
// DATA_SOURCE='odoo' this becomes a proper authenticated admin session.
const ADMIN_PASS = process.env.NEXT_PUBLIC_ADMIN_PASS ?? 'almond';

interface AdminAuthState {
  authed: boolean;
  login: (pass: string) => boolean;
  logout: () => void;
}

export const useAdminAuth = create<AdminAuthState>()(
  persist(
    (set) => ({
      authed: false,
      login: (pass) => {
        const ok = pass === ADMIN_PASS;
        if (ok) set({ authed: true });
        return ok;
      },
      logout: () => set({ authed: false }),
    }),
    {
      name: 'almond-admin',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : (undefined as never),
      ),
    },
  ),
);
