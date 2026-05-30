/**
 * Central theme file — Almond Coffee House design system.
 * Revision Pack §L: a deeper, richer, higher-contrast palette (Starbucks-grade
 * warmth). Gold accents only on CTAs, prices, active states.
 */

export const colors = {
  dark: '#1A0F08', // espresso — primary, dark bars & cards
  brown: '#5C3A21', // mocha
  gold: '#D4A24E', // accent — CTAs, prices, active states (brighter, livelier)
  lightGold: '#F0D89A',
  cream: '#F7F1E6', // warm background (not washed out)
  cardBg: '#FFFFFF', // clean contrast on cream
  warmGray: '#8A7A66', // secondary text only
  green: '#2D6A4F', // success
  red: '#C0392B', // error / closed
  white: '#FFFFFF',
  // warm gradient stops for hero/loyalty/cup elements
  gradGoldA: '#E0B868',
  gradGoldB: '#C68A2E',
  gradDarkA: '#2A1810',
  gradDarkB: '#120A04',
  // tier colors
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

// Softer but deeper shadows for warmth + depth (Revision Pack §L).
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

// Warm gradient presets for hero cards (used with <Gradient>).
export const gradients = {
  gold: [colors.gradGoldA, colors.gradGoldB] as const,
  dark: [colors.gradDarkA, colors.gradDarkB] as const,
  mocha: ['#6B4528', '#3D2616'] as const,
};

/**
 * Font families. Arabic body: Tajawal. English headings: Playfair Display.
 * English body: Inter. Keys map to loaded font names in constants/fonts.ts.
 */
export const fontFamily = {
  light: 'Tajawal_300Light',
  regular: 'Tajawal_400Regular',
  medium: 'Tajawal_500Medium',
  bold: 'Tajawal_700Bold',
  serif: 'PlayfairDisplay_700Bold', // English headings
  serifRegular: 'PlayfairDisplay_400Regular',
  inter: 'Inter_400Regular',
  interBold: 'Inter_600SemiBold',
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

export const theme = { colors, spacing, radius, shadow, fontFamily, fontSize, timing };
export type Theme = typeof theme;
