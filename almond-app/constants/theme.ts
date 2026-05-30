/**
 * Central theme file — Almond Coffee House design system (section 3).
 * Warm premium coffee-house aesthetic. Gold accents only on CTAs, prices, active states.
 */

export const colors = {
  dark: '#1C1208', // deep espresso — primary
  brown: '#6B3F1F',
  gold: '#C8962A', // accent — CTAs, prices
  lightGold: '#E8C86A',
  cream: '#F5EFE0', // background
  cardBg: '#FDFAF4',
  warmGray: '#8C7B6B',
  green: '#2D6A4F', // success
  red: '#C0392B', // error
  white: '#FFFFFF',
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

export const shadow = {
  card: {
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  raised: {
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

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
