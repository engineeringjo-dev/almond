'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ItemPatch } from '@/data/menu';

interface OverlayState {
  edits: Record<string, ItemPatch>;
  setEdit: (id: string, patch: ItemPatch) => void;
  resetItem: (id: string) => void;
  resetAll: () => void;
}

/**
 * Admin menu edits overlay. Mock persistence (localStorage) so edits show on the
 * website immediately. The Odoo data source replaces this with server writes
 * that both web + app read — see src/data/menu.ts.
 */
export const useMenuOverlay = create<OverlayState>()(
  persist(
    (set) => ({
      edits: {},
      setEdit: (id, patch) =>
        set((s) => ({ edits: { ...s.edits, [id]: { ...s.edits[id], ...patch } } })),
      resetItem: (id) =>
        set((s) => {
          const edits = { ...s.edits };
          delete edits[id];
          return { edits };
        }),
      resetAll: () => set({ edits: {} }),
    }),
    {
      name: 'almond-menu-overlay',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : (undefined as never),
      ),
    },
  ),
);
