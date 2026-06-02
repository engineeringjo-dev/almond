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

// Experimental green theme (Starbucks-style comparison).
export const greenTheme: AppTheme = {
  primary: '#00704A',
  primaryDark: '#1E3932',
  accent: '#D4A24E',
  accentLight: '#F0D89A',
  secondary: '#2A5A47',
  neutralWarm: '#D4E9E2',
  cream: '#F7F4EF',
  cardBg: '#FFFFFF',
  textPrimary: '#1E3932',
  textSecondary: '#6B7B74',
  success: '#00704A',
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
  // tier colors (brand-independent)
  tierBean: '#8C6239',
  tierSilver: '#9AA0A6',
  tierGold: '#C9A06A',
  tierBlack: '#2B2B2B',
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
  gold: ['#E0B868', theme.accent] as const,
  dark: [theme.primary, theme.primaryDark] as const,
  mocha: [theme.secondary, theme.primaryDark] as const,
  // Points / loyalty hero — soft pastel rainbow (light → purple).
  rainbow: ['#EAF4EC', '#F7F1D4', '#F3D9B6', '#E6A2AF', '#C796C1'] as const,
  // All other hero blocks — lavender → blue.
  purple: ['#C2B9DB', '#9DAAD1', '#6E9AC4', '#4A8EBB'] as const,
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
