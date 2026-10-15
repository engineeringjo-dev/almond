import { Image, StyleProp, ImageStyle } from 'react-native';
import { colorScheme } from '@/constants/theme';

/**
 * Almond brand logo (replaces the old coffee-cup emoji). Two forms:
 *  - 'badge'    → square icon mark (cup/croissant/music/book)
 *  - 'wordmark' → full horizontal lockup incl. "ALMOND COFFEE HOUSE."
 * Two tones: 'dark' (black, for the page in light mode) and 'light' (white,
 * for the black card and for the page in dark mode). 'auto' — the default —
 * is the page's: black in light mode, white in dark. Stencil PNGs with a
 * transparent background, so they sit on any surface; the logo itself is
 * black and white, which is the identity (shared theme).
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
  tone?: 'dark' | 'light' | 'auto';
  /** Badge: square side. Wordmark: width (height auto from aspect ratio). */
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export function Logo({ variant = 'badge', tone = 'auto', size = 32, style }: Props) {
  const ink = tone === 'auto' ? (colorScheme === 'dark' ? 'light' : 'dark') : tone;
  const source = SOURCES[`${variant}-${ink}` as keyof typeof SOURCES];
  const dims =
    variant === 'wordmark'
      ? { width: size, height: Math.round(size * WORDMARK_RATIO) }
      : { width: size, height: size };
  return <Image source={source} style={[dims, style]} resizeMode="contain" />;
}
