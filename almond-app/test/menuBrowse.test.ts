import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { categories, menuItems } from '@almond/shared/menu/seed';
import { categoryKind } from '@almond/shared/lib/categoryKind';
import { matchesMenuQuery, menuBand, orderMenuSections, sectionOrders } from '@almond/shared/menu/browse';
import { menuService } from '@/services/menu.service';

/**
 * BROWSING THE MENU (Dunkin' panel, 2026-10-15): one section order and one
 * search for the app and the website, both in packages/shared/menu/browse.ts.
 * The app opened on «فرابيه قهوة» (3.2% of orders) and the website on «ألواح»
 * (0.3%); the app's search skipped the Arabic description the website read.
 */
const ordered = orderMenuSections(categories, menuItems);
const orders = sectionOrders(menuItems);
const kindAt = (i: number) => categoryKind(ordered[i]!.id);
const lastIndex = (pred: (i: number) => boolean) => ordered.map((_, i) => i).filter(pred).pop() ?? -1;
const firstIndex = (pred: (i: number) => boolean) => ordered.map((_, i) => i).find(pred) ?? -1;

describe('MB1 the menu opens on what the shop sells', () => {
  it('the seasonal section first while it has items, then the drink that sells most', () => {
    const seasonal = categories.filter((c) => menuBand(c) === 'seasonal');
    expect(seasonal.length, 'the shipped menu has a seasonal section').toBeGreaterThan(0);
    expect(menuBand(ordered[0]!)).toBe('seasonal');
    const drinks = categories.filter((c) => menuBand(c) === 'drink');
    const top = [...drinks].sort((a, b) => (orders.get(b.id) ?? 0) - (orders.get(a.id) ?? 0))[0]!;
    expect(ordered[seasonal.length]!.id).toBe(top.id);
  });

  it('every drink before every food, every food and sweet before the retail shelf', () => {
    expect(lastIndex((i) => kindAt(i) === 'drink')).toBeLessThan(firstIndex((i) => kindAt(i) === 'food'));
    const retail = firstIndex((i) => menuBand(ordered[i]!) === 'retail');
    expect(retail).toBeGreaterThan(lastIndex((i) => kindAt(i) === 'food'));
  });

  it('savoury before sweet, and inside a band the section that sold most first', () => {
    const lastFood = lastIndex((i) => menuBand(ordered[i]!) === 'food');
    const firstSweet = firstIndex((i) => menuBand(ordered[i]!) === 'sweet');
    expect(lastFood).toBeLessThan(firstSweet);
    for (let i = 1; i < ordered.length; i += 1) {
      const a = ordered[i - 1]!;
      const b = ordered[i]!;
      if (menuBand(a) !== menuBand(b)) continue;
      expect(orders.get(a.id) ?? 0, `${a.nameEn} before ${b.nameEn}`).toBeGreaterThanOrEqual(orders.get(b.id) ?? 0);
    }
  });

  it('no live section falls through to the end unclassified', () => {
    // «طلب جانبي» (water, candles, a gift box) is the one section that is none
    // of the bands, and it is meant to be last. A NEW Odoo section the rules
    // do not know would land beside it unseen; this goes red instead, so the
    // rules in lib/categoryKind.ts learn its name.
    expect(categories.filter((c) => menuBand(c) === 'other').map((c) => c.nameEn)).toEqual(['Sides']);
    expect(menuBand(ordered[ordered.length - 1]!)).toBe('other');
  });

  it('the app shows that order — the same function the website calls', async () => {
    const shown = (await menuService.getCategories()).filter((c) => c.id !== 'all').map((c) => c.id);
    expect(shown).toEqual(ordered.map((c) => c.id));
    // «الكل» leads with the first section's items, not Odoo's first.
    const all = await menuService.getItems('all');
    expect(all[0]!.categoryId).toBe(ordered[0]!.id);
  });
});

describe('MB2 one search, read the way people type Arabic', () => {
  const ids = (q: string) => menuItems.filter((i) => matchesMenuQuery(i, q)).map((i) => i.id);

  it('hamza, taa marbuta and alef maqsura fold; diacritics and tatweel are ignored', () => {
    expect(ids('اسبريسو').length).toBeGreaterThan(0);
    expect(ids('اسبريسو')).toEqual(ids('إسبريسو'));
    expect(ids('كيكه')).toEqual(ids('كيكة'));
    expect(ids('كَيـكة')).toEqual(ids('كيكة'));
  });

  it('a query in Arabic-Indic digits finds the Latin digits on the menu', () => {
    expect(ids('٢٥٠').length).toBeGreaterThan(0);
    expect(ids('٢٥٠')).toEqual(ids('250'));
  });

  it('both names and both descriptions — the app skipped the Arabic one', () => {
    const item = { nameAr: 'قهوة تركية', nameEn: 'Turkish Coffee', descAr: 'مع الهيل', descEn: '' };
    expect(matchesMenuQuery(item, 'الهيل')).toBe(true);
    expect(matchesMenuQuery({ ...item, descAr: '', descEn: 'with cardamom' }, 'CARDAMOM')).toBe(true);
    expect(matchesMenuQuery(item, 'zzqq')).toBe(false);
  });

  it('the app\'s search box and its menu service answer the same', async () => {
    // «كيكه», which only the folded rule finds: a plain `includes` finds none.
    const viaService = (await menuService.searchItems('كيكه')).map((i) => i.id).sort();
    expect(viaService.length).toBeGreaterThan(0);
    expect(viaService).toEqual(ids('كيكه').sort());
  });

  it('the Order tab\'s box filters through the shared rule, not a copy of it', () => {
    const src = readFileSync(join(__dirname, '..', 'app', '(tabs)', 'order.tsx'), 'utf8');
    expect(src).toMatch(/items\.filter\(\(i\) => matchesMenuQuery\(i, query\)\)/);
    expect(src).not.toMatch(/toLowerCase\(\)\.includes\(q\)/);
  });
});
