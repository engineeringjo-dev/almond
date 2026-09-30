/**
 * DRAG-TO-DISMISS FOR THE BOTTOM SHEET — the rule, apart from the gesture
 * plumbing so it can be tested.
 *
 * A sheet with a grabber promises that dragging it down closes it (HIG,
 * Material). The old grabber was drawn but did nothing (audit P2).
 *
 * Dismiss on distance OR on a flick: a quick downward flick is enough even if
 * short (emil-design-eng: velocity > ~0.11 px/ms), and a long slow drag is
 * enough even if it ends still. A few pixels of jitter is neither.
 */

/** px dragged down that always dismisses. */
export const SHEET_DISMISS_DISTANCE = 120;
/** px/ms at release (PanResponder `vy`) that dismisses a short drag. */
export const SHEET_DISMISS_VELOCITY = 0.11;
/** Below this, a release is a tap or jitter, never a dismissal. */
export const SHEET_MIN_DRAG = 8;
/** Upward drag is damped, not blocked, and never lifts the sheet more than this. */
export const SHEET_MAX_LIFT = 24;

export function shouldDismissSheet(dy: number, vy: number): boolean {
  if (dy >= SHEET_DISMISS_DISTANCE) return true;
  return dy > SHEET_MIN_DRAG && vy > SHEET_DISMISS_VELOCITY;
}

/** Where the sheet sits while the finger is at `dy`: 1:1 down, damped up. */
export function dragOffset(dy: number): number {
  if (dy >= 0) return dy;
  return -Math.min(SHEET_MAX_LIFT, Math.sqrt(-dy) * 2);
}
