import { colors, gradients } from '@almond/shared/theme';
import type { CSSProperties } from 'react';

/**
 * The single source of truth for the brand palette is `@almond/shared/theme`.
 * We turn it into CSS custom properties and set them on <html> at render time,
 * so Tailwind tokens (`bg-primary`, `bg-gradient-rainbow`, …) resolve to the
 * exact same violet identity the mobile app uses — no duplicated hex values.
 */
const gradient = (stops: readonly string[]) =>
  `linear-gradient(135deg, ${stops.join(', ')})`;

/**
 * '#6C5CB4' → '108 92 180'. Tailwind can only apply an opacity modifier
 * (`bg-error/10`) to a colour it can split into channels; given a bare
 * `var(--color-error)` it silently emits NO CSS for `bg-error/10`. That made
 * the sticky menu bars see-through and five back-office tints invisible. Each
 * colour is therefore also published as space-separated channels, which
 * tailwind.config.ts wraps as `rgb(var(--…-rgb) / <alpha-value>)`.
 * Throws on any other format rather than emitting a broken colour.
 */
export function hexToChannels(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`theme colour must be #RRGGBB, got ${JSON.stringify(hex)}`);
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

const COLOR_VARS = {
  '--color-primary': colors.primary,
  '--color-primary-dark': colors.dark,
  '--color-accent': colors.gold,
  '--color-accent-light': colors.lightGold,
  '--color-secondary': colors.brown,
  '--color-neutral-warm': colors.neutralWarm,
  '--color-background': colors.cream,
  '--color-card': colors.cardBg,
  '--color-text-primary': colors.dark,
  '--color-text-secondary': colors.warmGray,
  '--color-success': colors.green,
  '--color-error': colors.red,
  '--color-tier-bean': colors.tierBean,
  '--color-tier-silver': colors.tierSilver,
  '--color-tier-gold': colors.tierGold,
  '--color-tier-black': colors.tierBlack,
} as const;

/** The same palette as `--color-x-rgb: r g b`, for the Tailwind colour tokens. */
export const channelVars: Record<string, string> = Object.fromEntries(
  Object.entries(COLOR_VARS).map(([k, hex]) => [`${k}-rgb`, hexToChannels(hex)]),
);

export const themeVars = {
  ...COLOR_VARS,
  ...channelVars,
  '--gradient-rainbow': gradient(gradients.rainbow),
  '--gradient-purple': gradient(gradients.purple),
  '--gradient-dark': gradient(gradients.dark),
} as unknown as CSSProperties;
