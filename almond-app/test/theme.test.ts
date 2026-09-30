import { describe, it, expect } from 'vitest';

import { colors, theme } from '@almond/shared/theme';

/**
 * T1-T3 — A RESTING CONTROL IS VISIBLE, AND ITS TEXT STAYS READABLE (audit P2).
 *
 * The violet theme set the page (`cream`) and the card (`cardBg`) both to
 * white, so an unselected size, milk or category chip had no fill and no edge:
 * it read as plain text. `surface` (the resting control fill) and `outline`
 * (its boundary) bring the control back without touching the brand violet.
 * Ratios are WCAG 2.x relative-luminance contrast.
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

describe('T0 the ratio itself', () => {
  it('black on white is 21:1, a colour on itself 1:1', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#6C5CB4', '#6C5CB4')).toBe(1);
  });
});

describe('T1 a control has its own surface', () => {
  it('the control fill differs from the page and the card', () => {
    expect(colors.surface).not.toBe(colors.cream);
    expect(colors.surface).not.toBe(colors.cardBg);
  });

  it('the brand violet is untouched', () => {
    expect(theme.primary).toBe('#6C5CB4');
    expect(colors.primary).toBe('#6C5CB4');
  });
});

describe('T2 text on every surface a control sits on is AA (≥4.5:1)', () => {
  const grounds = { page: colors.cream, card: colors.cardBg, control: colors.surface };
  for (const [gName, ground] of Object.entries(grounds)) {
    for (const [tName, text] of Object.entries({ primary: colors.dark, secondary: colors.warmGray, violet: colors.primary })) {
      it(`${tName} text on the ${gName}`, () => {
        expect(contrast(text, ground)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('a selected chip (light violet) carries primary text, AA', () => {
    expect(contrast(colors.dark, colors.lightGold)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('T3 a control boundary is ≥3:1 (WCAG 1.4.11)', () => {
  for (const [gName, ground] of Object.entries({ page: colors.cream, card: colors.cardBg, control: colors.surface })) {
    it(`the outline against the ${gName}`, () => {
      expect(contrast(colors.outline, ground)).toBeGreaterThanOrEqual(3);
    });
  }

  it('a selected chip keeps a violet edge against its light fill', () => {
    expect(contrast(colors.primary, colors.lightGold)).toBeGreaterThanOrEqual(3);
  });
});
