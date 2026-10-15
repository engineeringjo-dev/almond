import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { paletteFor } from '@almond/shared/theme';
import { balanceBuys } from '@almond/shared/loyalty/balanceBuys';
import { bestSellers } from '@almond/shared/lib/recommendations';
import { itemFromPrice } from '@almond/shared/menu';

/**
 * VF — THE VISUAL EXPERT'S FIXES (Dunkin' panel, 2026-10-15), each measured
 * the way the expert measured it, in both schemes.
 */
const src = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe('VF1 the rungs ahead can be seen, and the member\'s rung is named', () => {
  const ladder = src('components/loyalty/TierProgress.tsx');
  it('the track and an unreached rung are `outline`, ≥3:1 on the card in both schemes (WCAG 1.4.11)', () => {
    expect(/track: \{[^}]*backgroundColor: colors\.outline/.test(ladder)).toBe(true);
    expect(/stop: \{[^}]*borderColor: colors\.outline/.test(ladder)).toBe(true);
    for (const scheme of ['light', 'dark'] as const) {
      const p = paletteFor(scheme);
      expect(contrast(p.outline, p.cardBg), scheme).toBeGreaterThanOrEqual(3);
    }
    // It was neutralWarm: 1.15:1 on the white card.
    expect(contrast(paletteFor('light').neutralWarm, paletteFor('light').cardBg)).toBeLessThan(1.2);
  });

  it('«فئتك» under the current rung — not colour alone (WCAG 1.4.1)', () => {
    expect(ladder).toMatch(/\{tr\.id === tier \? \(\s*<Text variant="caption"[^>]*>\s*\{t\('loyalty\.tier'\)\}/);
  });
});

describe('VF2 dark mode dims a product photograph', () => {
  it('the layer is nothing in light mode, and leaves the primary button the brightest in dark', () => {
    expect(paletteFor('light').photoDim).toBe('transparent');
    const m = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(paletteFor('dark').photoDim);
    expect(m).toBeTruthy();
    const [, r, , , a] = m!;
    const white = Math.round(255 * (1 - Number(a)) + Number(r) * Number(a));
    const primary = parseInt(paletteFor('dark').primary.slice(1, 3), 16);
    expect(white, 'the dimmed white').toBeLessThan(primary);
    expect(white, 'still reads as a white plate').toBeGreaterThan(215);
  });

  it('every place a menu photograph is drawn lays it on', () => {
    for (const rel of ['components/home/PhotoTile.tsx', 'components/menu/MenuItemCard.tsx', 'components/menu/ItemModal.tsx', 'app/(tabs)/order.tsx']) {
      const s = src(rel);
      expect(s, rel).toMatch(/import \{ PhotoDim \} from '@\/components\/ui\/PhotoDim';/);
      expect(s, rel).toMatch(/<PhotoDim \/>/);
    }
  });
});

describe('VF3 the photograph leads the Home tile', () => {
  const tile = src('components/home/PhotoTile.tsx');
  it('runs to the tile\'s edge, full height, clipped by the tile\'s corners', () => {
    const block = /\n {2}tile: \{([^}]*)\}/.exec(tile)?.[1] ?? '';
    expect(block).toMatch(/overflow: 'hidden'/);
    expect(block).not.toMatch(/padding/);
    expect(/\n {2}plate: \{([^}]*)\}/.exec(tile)?.[1]).toMatch(/alignSelf: 'stretch'/);
    expect(/\n {2}words: \{([^}]*)\}/.exec(tile)?.[1]).toMatch(/padding: spacing\.lg/);
    expect(tile).toMatch(/plate = 140,/);
  });
});

describe('VF4 what the balance buys now', () => {
  const top = bestSellers(1, { kind: 'drink' })[0]!;
  const priceFils = Math.round(itemFromPrice(top) * 1000);
  it('the most-ordered drink, as many times as the balance pays for it in full', () => {
    expect(balanceBuys(1240)).toEqual({ item: top, times: Math.floor(12400 / priceFils) });
    // Exactly two drinks' worth says two (counted in fils, not floats).
    expect(balanceBuys((priceFils * 2) / 10)?.times).toBe(2);
  });

  it('nothing below the price of one — never «ينقصك…», which is a threshold by another name', () => {
    expect(balanceBuys(priceFils / 10 - 1)).toBeNull();
    expect(balanceBuys(0)).toBeNull();
    // Arabic says «ثمن 3 لاتيه»: «3×» read against «×2» and «×1.5» on the same
    // screen (Arabic expert, 2026-10-15). English keeps "3× Latte".
    const shape = { ar: /ثمن \{\{times\}\} \{\{name\}\}/, en: /\{\{times\}\}× \{\{name\}\}/ };
    for (const lang of ['ar', 'en'] as const) {
      const v = JSON.parse(src(`locales/${lang}.json`)).rewards.balanceBuys as string;
      expect(v).toMatch(shape[lang]);
      expect(v).not.toMatch(/ينقص|بقي|تحتاج|more|need|left/i);
    }
  });

  it('the rewards and loyalty screens say it under the balance', () => {
    expect(src('app/(tabs)/rewards.tsx')).toMatch(/<BalanceWorth points=\{points\} \/>/);
    expect(src('app/loyalty.tsx')).toMatch(/<BalanceWorth points=\{balance\.points\} \/>/);
  });
});
