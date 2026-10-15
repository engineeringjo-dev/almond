import { describe, it, expect } from 'vitest';

import { categories, menuItems } from '@almond/shared/menu';
import { generatedMenuItems } from '@almond/shared/menu/menu.generated';
import { GROUP_AR, OPTION_AR, localizeMenuItems } from '@almond/shared/menu/localize';

/**
 * ML1-ML3 — the menu as an Arabic reader sees it (packages/shared/src/menu/
 * localize.ts). Owner, 2026-10-15: «استخدم الارقام اللاتينية فقط» and «اصلح
 * النص» — «Full Fat Milk» sat in English between two Arabic milks on the latte.
 */
const INDIC = /[٠-٩۰-۹]/;
const ARABIC = /[؀-ۿ]/;

describe('ML1 every name on the menu is in Latin digits', () => {
  it('items, descriptions, sizes, groups, options and categories', () => {
    const offenders: string[] = [];
    for (const c of categories) if (INDIC.test(c.nameAr)) offenders.push(`category ${c.nameAr}`);
    for (const m of menuItems) {
      for (const s of [m.nameAr, m.descAr ?? '', ...m.sizes.map((z) => z.nameAr)]) {
        if (INDIC.test(s)) offenders.push(`${m.id}: ${s}`);
      }
      for (const g of m.customizations) {
        for (const s of [g.nameAr, ...g.options.map((o) => o.nameAr)]) {
          if (INDIC.test(s)) offenders.push(`${m.id}: ${s}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the raw pull really did carry them — the pass is doing work, not passing vacuously', () => {
    expect(generatedMenuItems.some((m) => INDIC.test(m.nameAr))).toBe(true);
  });
});

describe('ML2 a modifier Odoo names only in English reads Arabic', () => {
  it('every listed option and group arrives with an Arabic name', () => {
    const offenders: string[] = [];
    for (const m of menuItems) {
      for (const g of m.customizations) {
        if (GROUP_AR[g.nameEn] && !ARABIC.test(g.nameAr)) offenders.push(`${m.id} group ${g.nameEn}`);
        for (const o of g.options) {
          if (OPTION_AR[o.nameEn] && !ARABIC.test(o.nameAr)) offenders.push(`${m.id} ${o.nameEn}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the iced latte offers «حليب كامل الدسم», not «Full Fat Milk»', () => {
    const latte = menuItems.find((m) => m.nameAr === 'لاتيه مثلج')!;
    const names = latte.customizations.flatMap((g) => g.options.map((o) => o.nameAr));
    expect(names).toContain('حليب كامل الدسم');
    expect(names).not.toContain('Full Fat Milk');
  });
});

describe('ML3 Odoo\'s own Arabic always wins', () => {
  it('a translated option keeps Odoo\'s words, digits aside', () => {
    const [item] = localizeMenuItems([{
      ...menuItems[0]!,
      nameAr: 'بيتزا ٣ انواع',
      customizations: [{
        id: 'g', nameAr: 'الحليب', nameEn: 'Milk', multiple: false,
        options: [
          { id: 'a', nameAr: 'حليب كامل', nameEn: 'Full Fat Milk', priceDelta: 0 },
          { id: 'b', nameAr: 'Full Fat Milk', nameEn: 'Full Fat Milk', priceDelta: 0 },
          { id: 'c', nameAr: 'Oat Milk ٢', nameEn: 'Oat Milk ٢', priceDelta: 0 },
        ],
      }],
    }]);
    expect(item!.nameAr).toBe('بيتزا 3 انواع');
    expect(item!.customizations[0]!.options.map((o) => o.nameAr))
      .toEqual(['حليب كامل', 'حليب كامل الدسم', 'Oat Milk 2']);
  });
});
