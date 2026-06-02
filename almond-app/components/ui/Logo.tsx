import { Image, StyleProp, ImageStyle } from 'react-native';

/**
 * Almond brand logo (replaces the old coffee-cup emoji). Two forms:
 *  - 'badge'    → square icon mark (cup/croissant/music/book)
 *  - 'wordmark' → full horizontal lockup incl. "ALMOND COFFEE HOUSE."
 * Two tones: 'dark' (for light backgrounds) and 'light' (for dark/purple).
 * Stencil PNGs with transparent background, so they sit on any surface.
 */
const SOURCES = {
  'badge-dark': require('../../assets/logo/almond-badge-dark.png'),
  'badge-light': require('../../assets/logo/almond-badge-light.png'),
  'wordmark-dark': require('../../assets/logo/almond-logo-dark.png'),
  'wordmark-light': require('../../assets/logo/almond-logo-light.png'),
} as const;

// Wordmark aspect ratio (1600 × 695).
const WORDMARK_RATIO = 695 / 1600;

interface Props {
  variant?: 'badge' | 'wordmark';
  tone?: 'dark' | 'light';
  /** Badge: square side. Wordmark: width (height auto from aspect ratio). */
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export function Logo({ variant = 'badge', tone = 'dark', size = 32, style }: Props) {
  const source = SOURCES[`${variant}-${tone}` as keyof typeof SOURCES];
  const dims =
    variant === 'wordmark'
      ? { width: size, height: Math.round(size * WORDMARK_RATIO) }
      : { width: size, height: size };
  return <Image source={source} style={[dims, style]} resizeMode="contain" />;
}
