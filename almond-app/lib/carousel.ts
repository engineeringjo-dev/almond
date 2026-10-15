/**
 * The arithmetic of PeekCarousel, kept apart so it can be tested without a
 * renderer. The component holds the index; these say where the row sits and
 * which slide a released swipe lands on.
 */

/**
 * Where the row sits to show slide `index`: one `step` (a slide and its gap)
 * per slide. `sign` is -1 when the slides run left to right (English), and +1
 * when they run right to left (Arabic). A transform is not mirrored by the
 * layout direction, so the sign has to be.
 */
export function carouselStep(index: number, step: number, sign: 1 | -1): number {
  return index === 0 ? 0 : sign * index * step;
}

export interface Release {
  index: number;
  /** How far the finger travelled, in points; right is positive. */
  dx: number;
  /** Its speed at release, in points per millisecond. */
  vx: number;
  slideWidth: number;
  /** Right-to-left: the next slide waits to the left. */
  rtl: boolean;
  last: number;
}

/** A fifth of a slide is a decision; less is a wobble. */
export const SWIPE_FRACTION = 0.2;
/** A flick this fast turns the page even when it was short. */
export const FLICK_SPEED = 0.3;

/**
 * Which slide a released swipe lands on: the next one in the reading
 * direction, the previous one, or the same one when the swipe was neither far
 * nor fast enough. Never past either end.
 */
export function settleIndex(r: Release): number {
  const far = Math.abs(r.dx) > r.slideWidth * SWIPE_FRACTION;
  const flick = Math.abs(r.vx) > FLICK_SPEED && Math.abs(r.dx) > 10;
  if (!far && !flick) return r.index;
  // In Arabic the next slide is brought in by a swipe to the RIGHT.
  const forward = r.rtl ? r.dx > 0 : r.dx < 0;
  return Math.max(0, Math.min(r.last, r.index + (forward ? 1 : -1)));
}
