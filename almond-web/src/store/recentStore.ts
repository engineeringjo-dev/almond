'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface RecentState {
  ids: string[];
  push: (id: string) => void;
}

const MAX = 8;

/** Recently-viewed menu items (most-recent first), persisted to localStorage. */
export const useRecentStore = create<RecentState>()(
  persist(
    (set) => ({
      ids: [],
      push: (id) => set((s) => ({ ids: [id, ...s.ids.filter((x) => x !== id)].slice(0, MAX) })),
    }),
    {
      name: 'almond-recent',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : (undefined as never),
      ),
    },
  ),
);
