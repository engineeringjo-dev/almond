/**
 * Central theme file — Almond Coffee House design system.
 *
 * 🔴 BLACK AND WHITE, LIKE THE LOGO. Owner, 2026-10-15: «اعمل الهوية اسود
 * وابيض كالشعار … المحل اندستريا واجهاته وسقفه اسود … انسى البنفسجي». The
 * logo is a black outline square holding four line drawings and «ALMOND COFFEE
 * HOUSE.» in a heavy grotesk; the shops are industrial, black facades and
 * black ceilings. So the identity is ink and paper — near-black, near-white
 * and the greys between them — and nothing else carries the brand. The violet
 * theme (#6C5CB4) and the espresso-and-gold one that was never switched on are
 * both deleted, with every gradient (the rainbow, the purple, the gold).
 *
 * Colour is left only where it MEANS something: red for an error or a closed
 * branch, green for success. A seasonal campaign may add a colour of its own
 * inside its own artwork; the interface does not.
 *
 * TWO PALETTES, ONE SET OF NAMES. `lightTheme` and `darkTheme` fill the same
 * roles, so a screen written against `colors.dark` (the ink) and `colors.cream`
 * (the page) is right in both. The app picks one at launch from the phone's
 * setting (almond-app/constants/theme.ts); the website uses the light one.
 * Precedent: Apple HIG (Dark Mode) — follow the system setting and keep the
 * same roles in both appearances; Material 3 — a light and a dark scheme with
 * one set of colour roles.
 *
 * The names are older than the identity — `gold` is the accent, `cream` the
 * page — and are kept so ~100 call sites did not have to change; the comment
 * beside each says what it is now.
 */

export type ColorScheme = 'light' | 'dark';

export interface AppTheme {
  /** The brand colour: the ink. Active tab, brand fills. */
  primary: string;
  /** Primary text, and the filled control (a primary button, a selected chip). */
  primaryDark: string;
  /** Text and icons ON an ink fill — white in light mode, near-black in dark. */
  onInk: string;
  /** Prices, highlights, links — the ink again: there is no second hue. */
  accent: string;
  /** A selected control's fill, under ink text and an ink edge. */
  accentLight: string;
  /** Captions on a card: the secondary grey. */
  secondary: string;
  /** Quiet fills: icon chips, thumbnails, dividers. */
  neutralWarm: string;
  /** The page. */
  cream: string;
  /** A card on the page. White on white in light mode (an edge or a shadow
   *  separates them); one step up from the page in dark mode, which is how a
   *  dark interface shows elevation. */
  cardBg: string;
  /**
   * The fill of a resting CONTROL (an unselected chip, a search field) — one
   * step off the page and the card, so it reads as something to press (audit
   * P2: unselected chips looked like plain text).
   */
  surface: string;
  /**
   * The boundary of a control: ≥3:1 against the page, the card and `surface`
   * (WCAG 1.4.11 non-text contrast), so a chip or a field is findable without
   * relying on its fill.
   */
  outline: string;
  textPrimary: string;
  textSecondary: string;
  success: string;
  error: string;
  /** The three rungs, darkest = highest in light mode, lightest = highest in
   *  dark: each carries `onInk` text at ≥4.5:1. */
  tierBase: string;
  tierPlus: string;
  tierTop: string;
}

export const lightTheme: AppTheme = {
  primary: '#111111',
  primaryDark: '#111111', // 18.9:1 on white
  onInk: '#FFFFFF',
  accent: '#111111',
  accentLight: '#E6E6E2', // ink 15.1:1 on it
  secondary: '#5C5C58',
  neutralWarm: '#EFEFEC',
  cream: '#FFFFFF',
  cardBg: '#FFFFFF',
  surface: '#F4F4F2', // ink 17.2:1, secondary 6.1:1
  outline: '#8A8A85', // 3.47:1 on white, 3.15:1 on surface
  textPrimary: '#111111',
  textSecondary: '#5C5C58', // 6.7:1 on white
  success: '#1E7B4A', // 5.3:1 on white
  error: '#B3261E', // 6.5:1 on white
  tierBase: '#6E6E69', // white 5.1:1
  tierPlus: '#3A3A37', // white 11.4:1
  tierTop: '#111111', // white 18.9:1
};

export const darkTheme: AppTheme = {
  primary: '#F2F2F0',
  primaryDark: '#F2F2F0', // 17.1:1 on the page
  onInk: '#0F0F0F',
  accent: '#F2F2F0',
  accentLight: '#33332F', // ink 11.3:1 on it
  secondary: '#A3A39E',
  neutralWarm: '#2A2A28',
  cream: '#0F0F0F',
  cardBg: '#1A1A19',
  surface: '#242423', // ink 13.9:1, secondary 6.1:1
  outline: '#75756F', // 4.1:1 on the page, 3.35:1 on surface
  textPrimary: '#F2F2F0',
  textSecondary: '#A3A39E', // 7.6:1 on the page
  success: '#6FCF97',
  error: '#F2B8B5',
  tierBase: '#8E8E88', // near-black text 5.8:1
  tierPlus: '#B5B5B0', // 9.3:1
  tierTop: '#F2F2F0', // 17.1:1
};

/**
 * The colour tokens for one scheme. The whole app references `colors.*`; the
 * app builds it once at launch for the phone's scheme, the website and the
 * tests read the light one below.
 */
export function paletteFor(scheme: ColorScheme) {
  const t = scheme === 'dark' ? darkTheme : lightTheme;
  return {
    dark: t.primaryDark, // the ink: primary text and filled controls
    onInk: t.onInk, // text and icons on an ink fill
    brown: t.secondary, // secondary grey for captions
    gold: t.accent, // the accent — the ink again
    lightGold: t.accentLight, // a selected control's fill
    cream: t.cream, // the page
    cardBg: t.cardBg, // a card
    surface: t.surface, // resting control fill (chips, fields)
    outline: t.outline, // control boundary, ≥3:1
    warmGray: t.textSecondary, // secondary text only
    green: t.success, // success
    red: t.error, // error / closed
    /** Literal white, for what is white in both schemes: a QR code's ground,
     *  text over a photograph. Never a surface or a text colour of the UI. */
    white: '#FFFFFF',
    neutralWarm: t.neutralWarm,
    primary: t.primary, // brand primary (active state / brand fills)
    tierBean: t.tierBase,
    tierSilver: t.tierPlus,
    tierGold: t.tierTop,
    tierBlack: t.tierTop,
    /** A scrim under a sheet or a dialog. */
    scrim: scheme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(17,17,17,0.45)',
    /**
     * THE BLACK CARD — the membership card, the wallet, a promotion: the
     * cards that used to be violet gradients. Black on the white page, like
     * the shops' black facades; in dark mode a black card would vanish into
     * the page and a white one would glare, so it is the raised card with an
     * edge. `onHero` is its text (18.9:1 / 15.5:1), `onHeroMuted` its
     * captions (10.0:1 / 6.9:1).
     */
    hero: scheme === 'dark' ? '#1A1A19' : '#111111',
    heroEdge: scheme === 'dark' ? '#3A3A37' : '#111111',
    onHero: scheme === 'dark' ? '#F2F2F0' : '#FFFFFF',
    onHeroMuted: scheme === 'dark' ? '#A3A39E' : '#BDBDB8',
  } as const;
}

export type Palette = ReturnType<typeof paletteFor>;

/** Shadows for one scheme. Soft and offset in light mode; in dark mode a
 *  shadow is all but invisible, so elevation is the card's lighter fill. */
export function shadowsFor(scheme: ColorScheme) {
  const opacity = scheme === 'dark' ? 0.5 : 1;
  return {
    card: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08 * opacity,
      shadowRadius: 8,
      elevation: 2,
    },
    raised: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.14 * opacity,
      shadowRadius: 16,
      elevation: 6,
    },
  } as const;
}

/** The light palette — the website's, and the default every test reads. */
export const theme: AppTheme = lightTheme;
export const colors = paletteFor('light');

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

export const shadow = shadowsFor('light');

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

/**
 * Widths for tablet, desktop and a wide browser window. The app is laid out
 * for a phone; on a wide window the journey screens and the bottom sheet stop
 * at a readable width, centred, instead of stretching a 700 px card and a
 * 1,400 px button across the glass (audit P2).
 */
export const layout = {
  contentMaxWidth: 680, // journey screens: menu grid, cart, review
  sheetMaxWidth: 640, // bottom sheets, centred (Material 3's bottom-sheet max width)
} as const;

export const tokens = { colors, spacing, radius, shadow, fontFamily, fontSize, timing, layout };
export type Tokens = typeof tokens;
