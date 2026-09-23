import { branches } from '@almond/shared/menu';
import type { Branch } from '@almond/shared/types';
import { ammanMinuteOfDay } from '@almond/shared/lib/ammanWeekday';

export function getBranches(): Branch[] {
  return branches;
}

/**
 * Is the branch currently open? Handles `close: "24:00"` (end of day = 1440).
 * Compute on the client (after mount) to avoid SSR/client time mismatch.
 */
export function isBranchOpen(branch: Branch, now: Date = new Date()): boolean {
  const [openH, openM] = branch.hours.open.split(':').map(Number);
  const [closeH, closeM] = branch.hours.close.split(':').map(Number);
  // Branch hours are Amman wall-clock times, whatever clock the visitor has.
  const minutes = ammanMinuteOfDay(now);
  return minutes >= openH * 60 + openM && minutes < closeH * 60 + closeM;
}
