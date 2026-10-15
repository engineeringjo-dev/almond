import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * I1-I2 — THE ITEM SHEET OPENS ON ITS PHOTOGRAPH AND ENDS ON ONE FILLED BUTTON
 * (expert panel, 2026-10-15: the photo was a 112pt thumbnail, about a fifth of
 * the width, and «أضف للسلة» was an outline weaker than the bar above it).
 */
const sheet = readFileSync(join(__dirname, '..', 'components/menu/ItemModal.tsx'), 'utf8');

describe('I1 the photograph is the first thing', () => {
  it('full width and at least 200pt tall', () => {
    const hero = /hero: \{([\s\S]*?)\n {2}\},/.exec(sheet)?.[1] ?? '';
    expect(hero, 'the hero style').toBeTruthy();
    expect(hero).toMatch(/alignSelf: 'stretch'/);
    const height = Number(/height: (\d+)/.exec(hero)?.[1] ?? 0);
    expect(height).toBeGreaterThanOrEqual(200);
  });
});

describe('I2 «أضف للسلة» is the one filled button, pinned under the sheet', () => {
  it('lives in the sheet\'s footer, as a primary Button', () => {
    const footer = /footer=\{([\s\S]*?)\n {6}\}\n {4}>/.exec(sheet)?.[1] ?? '';
    expect(footer, 'the BottomSheet footer').toBeTruthy();
    const button = /<Button\b[^>]*t\('menu\.addToCart'\)[^>]*\/>/.exec(footer)?.[0] ?? '';
    expect(button, 'the add-to-cart button is in the footer').toBeTruthy();
    // Primary is the default variant: filled ink, 52pt (components/ui/Button).
    expect(button).not.toMatch(/variant=/);
  });
});

/**
 * I3 — THE SHEET SAYS ONLY WHAT THE SHOP ITSELF SAYS (Dunkin' panel,
 * 2026-10-15). It printed calories, sugar and «يحتوي على الجلوتين» from one
 * estimate per category group: «120 سعرة · 9 غ سكر» on 47 items, «150 سعرة» on
 * the birthday candles, and «يحتوي على الجلوتين» on the 23 cakes and desserts
 * Odoo sells under «خالٍ من الجلوتين». No item has measured nutrition.
 */
describe('I3 no estimated nutrition; gluten-free only where Odoo says it', async () => {
  const { categories, menuItems } = await import('@almond/shared/menu/seed');
  const { tagsFor } = await import('@almond/shared/menu/publicFeed');
  const ar = JSON.parse(readFileSync(join(__dirname, '..', 'locales/ar.json'), 'utf8')) as Record<string, Record<string, string>>;
  const en = JSON.parse(readFileSync(join(__dirname, '..', 'locales/en.json'), 'utf8')) as Record<string, Record<string, string>>;
  const sectionEn = (id: string) => categories.find((c) => c.id === id)?.nameEn ?? '';
  const badged = (id: string) => {
    const item = menuItems.find((m) => m.id === id)!;
    return tagsFor(item, sectionEn(item.categoryId)).includes('gluten_free');
  };

  it('the sheet draws no calories, sugar or «contains gluten», and has no words for them', () => {
    expect(sheet).not.toMatch(/nutritionFor|menu\.calories|menu\.sugar|containsGluten/);
    for (const locale of [ar, en]) {
      expect(Object.keys(locale.menu!).filter((k) => /^calories|^sugar$|^containsGluten$|^nutritionNote$/.test(k))).toEqual([]);
    }
  });

  it('the badge is Odoo\'s claim: every item in a gluten-free section has it, a croissant does not', () => {
    expect(sheet).toMatch(/tagsFor\(item, categoryEn\)\.includes\('gluten_free'\)/);
    const glutenFreeSections = categories.filter((c) => /gluten-free/i.test(c.nameEn));
    expect(glutenFreeSections.length).toBe(2);
    const inThem = menuItems.filter((m) => glutenFreeSections.some((c) => c.id === m.categoryId));
    expect(inThem.length).toBe(23);
    expect(inThem.filter((m) => !badged(m.id)).map((m) => m.nameEn)).toEqual([]);
    const croissant = menuItems.find((m) => sectionEn(m.categoryId) === 'Croissants' && !/gluten|\bgf\b/i.test(m.nameEn))!;
    expect(badged(croissant.id)).toBe(false);
  });

  it('the badge sits on the quiet fill, not the selection fill (4.21:1 there)', () => {
    const pill = /dietPill: \{([\s\S]*?)\n {2}\},/.exec(sheet)?.[1] ?? '';
    expect(pill, 'the dietPill style').toBeTruthy();
    expect(pill).toMatch(/backgroundColor: colors\.neutralWarm/);
  });
});
