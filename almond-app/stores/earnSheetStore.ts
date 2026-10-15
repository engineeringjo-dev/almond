import { create } from 'zustand';

/**
 * The «اجمع نقاطك» sheet's visibility, so Home's header button and the launch
 * check can open the ONE sheet mounted at the root (app/_layout.tsx).
 *
 * `shownThisLaunch` lives in memory on purpose: a cold start resets it, a
 * return to Home in the same launch does not.
 */
interface EarnSheetState {
  visible: boolean;
  /** Opened by the launch check rather than by a tap — the sheet then offers
   *  «لا تفتحه تلقائياً». */
  auto: boolean;
  shownThisLaunch: boolean;
  open: (opts?: { auto?: boolean }) => void;
  close: () => void;
}

export const useEarnSheetStore = create<EarnSheetState>((set) => ({
  visible: false,
  auto: false,
  shownThisLaunch: false,
  open: (opts) => set({ visible: true, auto: !!opts?.auto, shownThisLaunch: true }),
  close: () => set({ visible: false }),
}));
