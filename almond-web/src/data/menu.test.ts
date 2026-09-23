import { describe, expect, it } from 'vitest';
import type { MenuItem } from '@almond/shared/types';
import { categories, menuItems } from '@almond/shared/menu';
import {
  applyItemPatch,
  applyOverlay,
  getAllCategories,
  getAllItems,
  getItemById,
  getMenuSections,
  itemFromPrice,
  searchItems,
} from '@/data/menu';

/**
 * Guards the website's menu layer (src/data/menu.ts): the admin overlay/patch
 * merge that the menu grid renders through, the category grouping, search, and
 * the "from" price the cards display (the shared itemFromPrice).
 */

const item = (over: Partial<MenuItem> = {}): MenuItem => ({
  id: 'x1',
  categoryId: 'coffee',
  nameAr: 'لاتيه',
  nameEn: 'Latte',
  emoji: '☕',
  sizes: [
    { id: 'S', nameAr: 'صغير', nameEn: 'Small', price: 2.5 },
    { id: 'L', nameAr: 'كبير', nameEn: 'Large', price: 3.25 },
  ],
  customizations: [],
  inStock: true,
  ...over,
});

describe('applyItemPatch', () => {
  it('returns the SAME object when there is no patch (cheap for React memo)', () => {
    const it0 = item();
    expect(applyItemPatch(it0)).toBe(it0);
    expect(applyItemPatch(it0, undefined)).toBe(it0);
  });

  it('overrides only the FIRST size price, leaving other sizes alone', () => {
    const out = applyItemPatch(item(), { price: 2.75 });
    expect(out.sizes.map((s) => s.price)).toEqual([2.75, 3.25]);
  });

  it('does not mutate the source item or its sizes array', () => {
    const src = item();
    const snapshot = structuredClone(src);
    applyItemPatch(src, { price: 9, inStock: false, nameAr: 'جديد', nameEn: 'New' });
    expect(src).toEqual(snapshot);
  });

  it('applies inStock (including false), and non-empty names', () => {
    const out = applyItemPatch(item(), { inStock: false, nameAr: 'فلات وايت', nameEn: 'Flat White' });
    expect(out).toMatchObject({ inStock: false, nameAr: 'فلات وايت', nameEn: 'Flat White' });
  });

  it('ignores an EMPTY name (an admin clearing the field must not blank the card)', () => {
    const out = applyItemPatch(item(), { nameAr: '', nameEn: '' });
    expect(out).toMatchObject({ nameAr: 'لاتيه', nameEn: 'Latte' });
  });

  it('accepts a price of 0 (explicit free item) and is a no-op on an item with no sizes', () => {
    expect(applyItemPatch(item(), { price: 0 }).sizes[0].price).toBe(0);
    const noSizes = item({ sizes: [] });
    expect(applyItemPatch(noSizes, { price: 5 }).sizes).toEqual([]);
  });

  // REGRESSION — fixed 2026-09-23 (was medium): src/data/menu.ts:75 accepts ANY number as a price patch, and
  // its only writer — src/components/admin/MenuEditor.tsx:91
  // `setEdit(item.id, { price: Number(price) })` — produces NaN for a garbage
  // value and 0 for a CLEARED field (`Number('') === 0`). Clearing the price box
  // and tabbing away therefore publishes the item at 0.000 JOD, and NaN renders
  // as "NaN د.أ". The data layer should drop non-finite / negative prices.
  it.each([[Number.NaN], [-1], [Number.POSITIVE_INFINITY]])(
    'ignores a non-finite or negative price patch (%s)',
    (bad) => {
      expect(applyItemPatch(item(), { price: bad }).sizes[0].price).toBe(2.5);
    },
  );
});

describe('applyOverlay', () => {
  const a = item({ id: 'a', nameEn: 'A' });
  const b = item({ id: 'b', nameEn: 'B' });
  const c = item({ id: 'c', nameEn: 'C' });

  it('drops hidden items, patches the rest, preserves order', () => {
    const out = applyOverlay([a, b, c], { b: { hidden: true }, c: { price: 9 } });
    expect(out.map((i) => i.id)).toEqual(['a', 'c']);
    expect(out[0]).toBe(a);
    expect(out[1].sizes[0].price).toBe(9);
  });

  it('hidden:false keeps the item; edits for unknown ids are ignored', () => {
    const out = applyOverlay([a], { a: { hidden: false }, ghost: { hidden: true, price: 1 } });
    expect(out).toEqual([a]);
  });

  it('with no edits is an identity on the real menu', () => {
    const out = applyOverlay(menuItems, {});
    expect(out).toHaveLength(menuItems.length);
    out.forEach((it0, i) => expect(it0).toBe(menuItems[i]));
  });
});

describe('itemFromPrice (shared) as the menu cards use it', () => {
  it('is the cheapest size when there is no mandatory group', () => {
    expect(itemFromPrice(item())).toBe(2.5);
    expect(itemFromPrice(item({ sizes: [...item().sizes].reverse() }))).toBe(2.5);
  });

  it('adds the cheapest option of each MANDATORY (single-choice) group — the 0.000-cake case', () => {
    const cake = item({
      sizes: [{ id: 'M', nameAr: 'عادي', nameEn: 'Regular', price: 0 }],
      customizations: [
        {
          id: 'choice',
          nameAr: 'اختيارك',
          nameEn: 'Your choice',
          multiple: false,
          options: [
            { id: 'l', nameAr: 'كبير', nameEn: 'Large', priceDelta: 20 },
            { id: 'm', nameAr: 'وسط', nameEn: 'Medium', priceDelta: 16 },
          ],
        },
      ],
    });
    expect(itemFromPrice(cake)).toBe(16);
  });

  it('does NOT add optional (multi-choice) extras', () => {
    const withExtras = item({
      customizations: [
        {
          id: 'extras',
          nameAr: 'إضافات',
          nameEn: 'Extras',
          multiple: true,
          options: [{ id: 'shot', nameAr: 'شوت', nameEn: 'Shot', priceDelta: 0.5 }],
        },
      ],
    });
    expect(itemFromPrice(withExtras)).toBe(2.5);
  });

  it('reflects an admin price patch through the overlay', () => {
    const single = item({ sizes: [{ id: 'M', nameAr: 'عادي', nameEn: 'Regular', price: 4.9 }] });
    expect(itemFromPrice(applyItemPatch(single, { price: 5.25 }))).toBe(5.25);
    // Multi-size: the patch moves only the first size, and "from" is still the min.
    expect(itemFromPrice(applyItemPatch(item(), { price: 4 }))).toBe(3.25);
  });

  it('no item on the real menu advertises a "from" price of 0 or less', () => {
    const zeroOrLess = menuItems.filter((i) => !(itemFromPrice(i) > 0)).map((i) => `${i.id} ${i.nameEn}`);
    expect(zeroOrLess).toEqual([]);
  });
});

describe('menu lookups and grouping (real shared menu)', () => {
  it('getAllItems / getAllCategories expose the shared arrays', () => {
    expect(getAllItems()).toBe(menuItems);
    expect(getAllCategories()).toBe(categories);
  });

  it('getItemById finds a real item and returns undefined for an unknown id', () => {
    const first = menuItems[0];
    expect(getItemById(first.id)).toBe(first);
    expect(getItemById('does-not-exist')).toBeUndefined();
  });

  it('every item id is unique and every item belongs to a known category', () => {
    expect(new Set(menuItems.map((i) => i.id)).size).toBe(menuItems.length);
    const known = new Set(categories.map((c) => c.id));
    expect(menuItems.filter((i) => !known.has(i.categoryId)).map((i) => i.id)).toEqual([]);
  });

  it('getMenuSections: category order, no empty sections, every item exactly once', () => {
    const sections = getMenuSections();
    const order = categories.map((c) => c.id);
    const idx = sections.map((s) => order.indexOf(s.category.id));
    expect(idx).toEqual([...idx].sort((x, y) => x - y));
    expect(sections.every((s) => s.items.length > 0)).toBe(true);
    const all = sections.flatMap((s) => s.items.map((i) => i.id));
    expect(all).toHaveLength(menuItems.length);
    expect(new Set(all).size).toBe(menuItems.length);
    for (const s of sections) expect(s.items.every((i) => i.categoryId === s.category.id)).toBe(true);
  });
});

describe('searchItems', () => {
  const sample = menuItems.find((i) => i.nameEn.trim().length >= 4 && i.nameAr.trim().length >= 3)!;

  it('returns nothing for a blank / whitespace query', () => {
    expect(searchItems('')).toEqual([]);
    expect(searchItems('   ')).toEqual([]);
  });

  it('matches English case-insensitively and trims the query', () => {
    const q = `  ${sample.nameEn.toUpperCase()}  `;
    expect(searchItems(q).map((i) => i.id)).toContain(sample.id);
  });

  it('matches Arabic names', () => {
    expect(searchItems(sample.nameAr).map((i) => i.id)).toContain(sample.id);
  });

  it('returns nothing for a string that is on no item', () => {
    expect(searchItems('zzqqxx-no-such-item')).toEqual([]);
  });
});
