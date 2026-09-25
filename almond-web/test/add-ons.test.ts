import { describe, expect, it } from 'vitest';
import type { MenuItem } from '@almond/shared/types';
import { ADD_ONS_GROUP_ID, addOnKey, attachAddOns } from '@almond/shared/menu/addOns';
import { menuItems } from '@almond/shared/menu/seed';

/**
 * Guards menu/addOns.ts — Odoo's separate add-on products (Extra Cold Foam,
 * Ice Cream…) offered on the items they are measured on (GM, 2026-09-25:
 * «ابني الموديفاير بشكل ادق واصح»).
 */

const latte: MenuItem = {
  id: 'p-1', categoryId: 'cat-23', nameAr: 'لاتيه', nameEn: 'Iced Latte', emoji: '',
  sizes: [{ id: 'S', nameAr: 'صغير', nameEn: 'Small', price: 3.5 }],
  customizations: [{ id: 'g-9', nameAr: '', nameEn: 'Extra Drink', multiple: true,
    options: [{ id: 'o-1', nameAr: '', nameEn: 'Extra Shot', priceDelta: 0.4 }, { id: 'o-2', nameAr: '', nameEn: 'Decaf', priceDelta: 0.4 }] }],
};
const products = [
  { id: 'm-foam', nameEn: 'Extra Cold Foam', nameAr: 'كولد فوم إضافي', price: 0.6 },
  { id: 'm-shot', nameEn: 'Extra Shot', nameAr: 'شوت', price: 0.4 },
  { id: 'm-decaf', nameEn: 'Extra Decaf Coffee', nameAr: 'ديكاف', price: 0.4 },
  { id: 'm-pump', nameEn: '1 Pump Of Caramel', nameAr: 'كراميل', price: 0 },
];
const link = (...ids: string[]) => ({ 'p-1': { modifiers: ids.map((modifierId) => ({ modifierId, share: 0.05 })) } });

describe('attachAddOns', () => {
  it('adds a priced «إضافات» multi-choice group with the measured add-ons', () => {
    const [out] = attachAddOns([latte], products, link('m-foam'));
    const g = out!.customizations.find((x) => x.id === ADD_ONS_GROUP_ID)!;
    expect(g).toMatchObject({ nameAr: 'إضافات', nameEn: 'Add-ons', multiple: true });
    expect(g.options).toEqual([{ id: 'm-foam', nameEn: 'Extra Cold Foam', nameAr: 'كولد فوم إضافي', priceDelta: 0.6 }]);
  });

  it('never offers what the item already has as a choice (one shot, charged once)', () => {
    const [out] = attachAddOns([latte], products, link('m-shot', 'm-decaf'));
    expect(out!.customizations.some((x) => x.id === ADD_ONS_GROUP_ID)).toBe(false);
    expect(addOnKey('Extra Decaf Coffee')).toBe(addOnKey('Decaf'));
    expect(addOnKey('1 Pump Of Caramel')).toBe(addOnKey('Caramel'));
  });

  it('never offers a free add-on, nor one it has no product for', () => {
    const [out] = attachAddOns([latte], products, link('m-pump', 'm-unknown'));
    expect(out).toBe(latte);
  });
});

describe('the shipped menu', () => {
  const withAddOns = menuItems.filter((m) => m.customizations.some((g) => g.id === ADD_ONS_GROUP_ID));

  it('carries measured add-ons, every one priced and named in Arabic', () => {
    expect(withAddOns.length).toBeGreaterThan(10);
    for (const m of withAddOns) {
      for (const o of m.customizations.find((g) => g.id === ADD_ONS_GROUP_ID)!.options) {
        expect(o.priceDelta, `${m.nameEn}:${o.nameEn}`).toBeGreaterThan(0);
        expect(o.nameAr, o.nameEn).toMatch(/[\u0600-\u06FF]/);
        expect(o.id).toMatch(/^m-\d+$/);
      }
    }
  });

  it('no add-on repeats something the item already offers', () => {
    for (const m of withAddOns) {
      const own = new Set(m.customizations.filter((g) => g.id !== ADD_ONS_GROUP_ID)
        .flatMap((g) => g.options.map((o) => addOnKey(o.nameEn))));
      const repeated = m.customizations.find((g) => g.id === ADD_ONS_GROUP_ID)!.options
        .filter((o) => own.has(addOnKey(o.nameEn))).map((o) => o.nameEn);
      expect(repeated, m.nameEn).toEqual([]);
    }
  });
});
