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

/** Returns white or deep violet — whichever clears AA (4.5:1) on `bgHex`. */
export function readableTextOn(bgHex: string): string {
  const l = luminance(bgHex);
  const contrastWithWhite = 1.05 / (l + 0.05);
  return contrastWithWhite >= 4.5 ? WHITE : DARK;
}
