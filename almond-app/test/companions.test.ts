import { describe, it, expect } from 'vitest';

import {
  COMPANION_PRICE_FLOOR,
  COMPANION_PRICE_RATIO,
  getItemPairings,
  isCompanion,
  isOccasionItem,
} from '@/lib/recommendations';
import { menuItems } from '@almond/shared/menu';
import { itemInsights } from '@almond/shared/menu/menu.insights.generated';
import type { MenuItem } from '@/types';

/**
 * P5 — A PAIRING IS A COMPANION (audit P2: «قالب لينزار التفاح» +16.000 under
 * a 3.950 iced latte). Measured on the bundled menu before the filter: 61 of
 * 1,500 item-page pairings were whole cakes.
 */
const price = (m: MenuItem) => m.sizes[0]?.price ?? 0;
const byNameEn = (n: string) => menuItems.find((m) => m.nameEn.trim() === n);

describe('P5 «يُطلب عادةً مع» offers companions, never an occasion purchase', () => {
  it('knows a whole cake, a mold and a pack from a slice', () => {
    const whole = byNameEn('Apple Linzer Full Cake');
    const slice = byNameEn('Apple Linzer Cake Piece');
    expect(whole && isOccasionItem(whole)).toBe(true);
    expect(slice && isOccasionItem(slice)).toBe(false);
    // Named as a mold but filed elsewhere — the name alone must catch it.
    const molds = menuItems.filter((m) => m.nameAr.includes('قالب'));
    expect(molds.length).toBeGreaterThan(5);
    for (const m of molds) expect(isOccasionItem(m), m.nameAr).toBe(true);
    // A cake pop is a treat, not a cake.
    const pop = byNameEn('Cake Pop');
    expect(pop && isOccasionItem(pop)).toBe(false);
  });

  it('each of the three signals catches an occasion item on its own', () => {
    // The menu is re-pulled from Odoo; a mold filed under slices with an
    // untranslated English name must still be caught by its Arabic name, and
    // the other way round. Built on a real slice so only one signal differs.
    const slice = byNameEn('Apple Linzer Cake Piece');
    const fullCakes = menuItems.find((m) => m.nameEn === 'Apple Linzer Full Cake');
    expect(slice && fullCakes).toBeTruthy();
    if (!slice || !fullCakes) return;
    expect(isOccasionItem({ ...slice, nameAr: 'قالب تجريبي', nameEn: 'Test' })).toBe(true);
    expect(isOccasionItem({ ...slice, nameAr: 'تجريبي', nameEn: 'Test Full Cheesecake' })).toBe(true);
    expect(isOccasionItem({ ...slice, nameAr: 'تجريبي', nameEn: 'Test', categoryId: fullCakes.categoryId })).toBe(true);
    expect(isOccasionItem({ ...slice, nameAr: 'تجريبي', nameEn: 'Test' })).toBe(false);
  });

  it('the iced latte no longer offers the 16.000 whole cake', () => {
    const latte = menuItems.find((m) => m.nameAr === 'لاتيه مثلج');
    expect(latte).toBeDefined();
    if (!latte) return;
    const shown = getItemPairings(latte, 4);
    expect(shown.length).toBe(4);
    expect(shown.map((m) => m.nameAr)).not.toContain('قالب لينزار التفاح');
    for (const p of shown) expect(price(p), p.nameEn).toBeLessThanOrEqual(2 * price(latte));
  });

  it('no item page on the menu pairs an occasion item or an over-priced one — and none is left empty', () => {
    const offenders: string[] = [];
    let emptied = 0;
    for (const item of menuItems) {
      if (item.sizes.length === 0) continue;
      const shown = getItemPairings(item, 4);
      if (shown.length === 0) emptied++;
      const ceiling = Math.max(COMPANION_PRICE_RATIO * price(item), COMPANION_PRICE_FLOOR);
      for (const p of shown) {
        if (isOccasionItem(p)) offenders.push(`${item.nameEn} → ${p.nameEn} (occasion)`);
        if (price(p) > ceiling) offenders.push(`${item.nameEn} → ${p.nameEn} ${price(p)} > ${ceiling}`);
      }
    }
    expect(offenders).toEqual([]);
    expect(emptied, 'the filter must not leave an item page with no suggestion').toBe(0);
  });

  it('keeps the measured order among what is left', () => {
    // Every item whose measured partners survive the filter leads with them,
    // strongest first — the filter removes, it never reorders.
    let checked = 0;
    for (const item of menuItems) {
      const measured = (itemInsights[item.id]?.crossSell ?? [])
        .map((c) => ({ id: c.itemId, score: c.attach * Math.log(c.lift) }))
        .sort((a, b) => b.score - a.score)
        .map((c) => menuItems.find((m) => m.id === c.id))
        .filter((m): m is MenuItem => !!m && m.id !== item.id && m.inStock !== false && isCompanion(item, m));
      if (measured.length === 0) continue;
      const shown = getItemPairings(item, 4).map((m) => m.id);
      expect(shown.slice(0, Math.min(4, measured.length)), item.nameEn).toEqual(
        measured.slice(0, 4).map((m) => m.id),
      );
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('a cheap item may still suggest a real companion (the floor)', () => {
    const tea = { ...menuItems[0], id: 'tea', sizes: [{ id: 'M' as const, nameAr: '', nameEn: '', price: 0.5 }] };
    const croissant = { ...menuItems[0], id: 'c', nameAr: 'كرواسون', nameEn: 'Croissant', categoryId: 'cat-2', sizes: [{ id: 'M' as const, nameAr: '', nameEn: '', price: 2.9 }] };
    expect(isCompanion(tea, croissant)).toBe(true);
    expect(isCompanion(tea, { ...croissant, sizes: [{ ...croissant.sizes[0], price: COMPANION_PRICE_FLOOR + 0.001 }] })).toBe(false);
  });
});
