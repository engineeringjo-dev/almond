import { create } from 'zustand';
import type { PendingVisit } from '@almond/shared/loyalty/visitRating';

/**
 * The thank-you after a visit (components/loyalty/PostVisitSheet.tsx), mounted
 * ONCE at the root. `visit` is what it is about; null means closed.
 */
interface VisitSheetState {
  visit: PendingVisit | null;
  open: (visit: PendingVisit) => void;
  close: () => void;
}

export const useVisitSheetStore = create<VisitSheetState>((set) => ({
  visit: null,
  open: (visit) => set({ visit }),
  close: () => set({ visit: null }),
}));
