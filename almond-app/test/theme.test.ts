import { describe, it, expect } from 'vitest';

import { darkTheme, lightTheme, paletteFor, type AppTheme, type ColorScheme } from '@almond/shared/theme';

/**
 * T0-T5 — THE IDENTITY IS BLACK AND WHITE, AND IT IS READABLE IN BOTH SCHEMES.
 *
 * Owner, 2026-10-15: «اعمل الهوية اسود وابيض كالشعار … المحل اندستريا واجهاته
 * وسقفه اسود … انسى البنفسجي». The palette is ink, paper and the greys between
 * (shared theme); colour is left only where it means something — an error, a
 * success. Every pairing a screen uses is held to WCAG 2.x here, in the light
 * scheme AND the dark one, because a pairing that is fine on white can vanish
 * on black (white on the ink is white on near-white in dark mode).
 */

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [16, 8, 0].map((s) => {
    const c = ((n >> s) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** How far a colour is from grey: the spread of its channels, 0-255. */
function chroma(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return Math.max(...c) - Math.min(...c);
}

describe('T0 the ratio itself', () => {
  it('black on white is 21:1, a colour on itself 1:1', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#111111', '#111111')).toBe(1);
  });
});

const SCHEMES: [ColorScheme, AppTheme][] = [['light', lightTheme], ['dark', darkTheme]];

describe('T1 black and white, like the logo', () => {
  // Every role that carries the BRAND — everything but success and error.
  const BRAND: (keyof AppTheme)[] = [
    'primary', 'primaryDark', 'onInk', 'accent', 'accentLight', 'secondary', 'neutralWarm',
    'cream', 'cardBg', 'surface', 'outline', 'textPrimary', 'textSecondary',
    'tierBase', 'tierPlus', 'tierTop',
  ];
  for (const [name, t] of SCHEMES) {
    it(`${name}: no brand role carries a hue — the violet is gone`, () => {
      const hued = BRAND.filter((k) => chroma(t[k]) > 8).map((k) => `${k}=${t[k]}`);
      expect(hued).toEqual([]);
    });
  }

  it('the two schemes fill the same roles, and the page and the ink swap', () => {
    expect(Object.keys(darkTheme).sort()).toEqual(Object.keys(lightTheme).sort());
    expect(luminance(lightTheme.cream)).toBeGreaterThan(luminance(lightTheme.primaryDark));
    expect(luminance(darkTheme.cream)).toBeLessThan(luminance(darkTheme.primaryDark));
  });
});

describe.each(SCHEMES)('T2-T5 the %s scheme', (_name, t) => {
  const grounds = { page: t.cream, card: t.cardBg, control: t.surface };

  for (const [gName, ground] of Object.entries(grounds)) {
    it(`T2 primary and secondary text on the ${gName} are AA (≥4.5:1)`, () => {
      expect(contrast(t.textPrimary, ground)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.textSecondary, ground)).toBeGreaterThanOrEqual(4.5);
    });
    it(`T3 a control's outline against the ${gName} is ≥3:1 (WCAG 1.4.11)`, () => {
      expect(contrast(t.outline, ground)).toBeGreaterThanOrEqual(3);
    });
  }

  it('T2 a selected chip carries ink text and an ink edge', () => {
    expect(contrast(t.primaryDark, t.accentLight)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.primaryDark, t.accentLight)).toBeGreaterThanOrEqual(3);
  });

  it('T4 text on an ink fill — a primary button, a selected tab — is AA', () => {
    expect(contrast(t.onInk, t.primaryDark)).toBeGreaterThanOrEqual(4.5);
  });

  it('T4 text on a success or an error fill is AA, in the same onInk', () => {
    expect(contrast(t.onInk, t.success)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.onInk, t.error)).toBeGreaterThanOrEqual(4.5);
  });

  it('T5 every rung of the ramp carries onInk at AA', () => {
    for (const tier of [t.tierBase, t.tierPlus, t.tierTop]) {
      expect(contrast(t.onInk, tier), tier).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('T5 the black card (HeroCard) reads in both schemes', () => {
  for (const scheme of ['light', 'dark'] as const) {
    it(scheme, () => {
      const c = paletteFor(scheme);
      expect(contrast(c.onHero, c.hero)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.onHeroMuted, c.hero)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
