/**
 * Pick a foreground colour (white or deep violet) that meets WCAG AA on a given
 * background hex. Used for tier badges whose brand colours (silver/gold) are too
 * light for white text — keeps the tier's identity colour while staying legible.
 */

/** WCAG relative luminance of a `#RRGGBB` hex. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** Deep violet from the brand palette (theme `primaryDark`). */
const DARK = '#2E2552';
const WHITE = '#FFFFFF';

/** Contrast ratio between two WCAG relative luminances. */
function ratio(l1: number, l2: number): number {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/** Returns white or deep violet — whichever has the higher contrast on `bgHex`. */
export function readableTextOn(bgHex: string): string {
  const bg = luminance(bgHex);
  return ratio(luminance(WHITE), bg) >= ratio(luminance(DARK), bg) ? WHITE : DARK;
}
