/**
 * Central theme file — Almond Coffee House design system.
 * Master Pack §1: a SINGLE switchable theme. Flip `theme` in one place to swap
 * the entire palette. Green is the experimental comparison theme (active now);
 * switch to `almondTheme` (espresso + gold) for the real launch identity.
 */

export interface AppTheme {
  primary: string;
  primaryDark: string;
  accent: string;
  accentLight: string;
  /** A mid brand tone (mocha for almond; deep green for the green theme). */
  secondary: string;
  neutralWarm: string;
  cream: string;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  success: string;
  error: string;
}

// Active brand theme — violet identity, ALL gold + green removed (per request).
// Accents are violet, success is violet, backgrounds are pure white (no beige),
// buttons are white/black, heroes use the violet gradients below.
export const greenTheme: AppTheme = {
  primary: '#6C5CB4', // violet — tab active, brand icons, active states
  primaryDark: '#2E2552', // deep violet — primary text + dark surfaces
  accent: '#6C5CB4', // violet — prices / highlights (was gold)
  accentLight: '#E3DEF3', // light violet (was light gold)
  secondary: '#8478C0', // lighter violet
  neutralWarm: '#ECE7F6', // soft lavender tint (icon chips / thumbs / dividers)
  cream: '#FFFFFF', // pure white backgrounds (was beige)
  cardBg: '#FFFFFF',
  textPrimary: '#2E2552',
  textSecondary: '#7A7390', // muted violet-gray secondary text
  success: '#6C5CB4', // violet (was green) — success/added/open
  error: '#C0392B',
};

// Official Almond identity (espresso + gold) — switch to this for launch.
export const almondTheme: AppTheme = {
  primary: '#3D2616',
  primaryDark: '#1A0F08',
  accent: '#D4A24E',
  accentLight: '#F0D89A',
  secondary: '#5C3A21',
  neutralWarm: '#EFE6D6',
  cream: '#F7F1E6',
  cardBg: '#FFFFFF',
  textPrimary: '#1A0F08',
  textSecondary: '#8A7A66',
  success: '#2D6A4F',
  error: '#C0392B',
};

// ← The single switch. Change to `almondTheme` for the real launch identity.
export const theme: AppTheme = greenTheme;

/**
 * Back-compatible color tokens derived from the active theme. The whole app
 * references `colors.*`; switching `theme` above re-skins everything at once.
 */
export const colors = {
  dark: theme.primaryDark, // dark bars/cards + primary text
  brown: theme.secondary, // mid brand tone (mocha / deep green)
  gold: theme.accent, // accent — CTAs, prices, active states
  lightGold: theme.accentLight,
  cream: theme.cream, // warm background
  cardBg: theme.cardBg, // clean cards
  warmGray: theme.textSecondary, // secondary text only
  green: theme.success, // success
  red: theme.error, // error / closed
  white: '#FFFFFF',
  neutralWarm: theme.neutralWarm,
  primary: theme.primary, // brand primary (active state / brand fills)
  // tier colors — a violet ramp (no gold/green), all dark enough for white text
  tierBean: '#8478C0',
  tierSilver: '#8A8F96',
  tierGold: '#5E51A0',
  tierBlack: '#2E2552',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16, // cards
  xl: 24,
  pill: 999,
} as const;

// Softer but deeper shadows for warmth + depth.
export const shadow = {
  card: {
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  raised: {
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// Gradient presets. gold/dark/mocha derive from the active theme; rainbow +
// purple are fixed brand gradients (from the design PDF) used on hero blocks.
export const gradients = {
  gold: ['#8478C0', theme.primary] as const, // (no gold) violet gradient
  dark: [theme.primary, theme.primaryDark] as const,
  mocha: [theme.secondary, theme.primaryDark] as const,
  // Signature colourful banner/hero + splash (the one exception to the
  // violet-only rule — kept colourful per request). Dark text stays readable.
  rainbow: ['#EAF4EC', '#F7F1D4', '#F3D9B6', '#E6A2AF', '#C796C1'] as const,
  // All other hero blocks — lavender → violet-blue.
  purple: ['#C2B9DB', '#9DAAD1', '#7E84C8', '#6C5CB4'] as const,
};

/**
 * Font families — Helvetica Neue (bilingual Arabic+Latin). Only Light/Roman/Bold
 * weights exist, so 'medium' maps to Bold for emphasis. Keys map to loaded font
 * names in constants/fonts.ts.
 */
export const fontFamily = {
  light: 'HelveticaNeueArabic-Light',
  regular: 'HelveticaNeueArabic-Roman',
  medium: 'HelveticaNeueArabic-Bold',
  bold: 'HelveticaNeueArabic-Bold',
  serif: 'HelveticaNeueArabic-Bold', // headings (Helvetica is sans — no serif)
  serifRegular: 'HelveticaNeueArabic-Roman',
  inter: 'HelveticaNeueArabic-Roman',
  interBold: 'HelveticaNeueArabic-Bold',
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 36,
} as const;

export const timing = {
  base: 300, // 300ms ease for standard animations
} as const;

export const tokens = { colors, spacing, radius, shadow, fontFamily, fontSize, timing };
export type Tokens = typeof tokens;
