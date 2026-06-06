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

export const themeVars = {
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
  '--gradient-rainbow': gradient(gradients.rainbow),
  '--gradient-purple': gradient(gradients.purple),
  '--gradient-dark': gradient(gradients.dark),
} as unknown as CSSProperties;
