import { describe, it, expect, vi } from 'vitest';
import type { MenuItem } from '@almond/shared/types';

/**
 * GM, 2026-09-25: «نتاكد ما حدا يقدر يطلب اوردر يطلع نتيجته ٠» — nobody can
 * place an order whose total is 0. `reprice` is the one function both the
 * card intent and the checkout price through, so the guard lives there.
 */

// A menu with one honest item and one whose every price is zero — the shape a
// mis-set Odoo product would arrive in if the pull's own guard were bypassed.
vi.mock('@almond/shared/menu', async () => {
  const actual = await vi.importActual<typeof import('@almond/shared/menu')>('@almond/shared/menu');
  const zero: MenuItem = {
    id: 'p-zero', categoryId: 'cat-1', nameAr: 'صفر', nameEn: 'Zero', emoji: '',
    sizes: [{ id: 'M', nameAr: 'عادي', nameEn: 'Regular', price: 0 }],
    customizations: [{ id: 'g-free', nameAr: 'مجاني', nameEn: 'Free', multiple: true,
      options: [{ id: 'o-free', nameAr: 'مجاني', nameEn: 'Free', priceDelta: 0 }] }],
  };
  return { ...actual, menuItems: [...actual.menuItems, zero] };
});

const { reprice } = await import('../src/pricing');
const { menuItems } = await import('@almond/shared/menu');

const real = menuItems.find((m) => m.id !== 'p-zero' && m.sizes[0]!.price > 0)!;
const line = (itemId: string, optionIds: string[] = []) =>
  ({ itemId, sizeId: 'M' as const, optionIds, qty: 1 });

describe('no order for nothing', () => {
  it('prices a real item above zero', () => {
    const r = reprice([{ ...line(real.id), sizeId: real.sizes[0]!.id }]);
    expect(r.totals.total).toBeGreaterThan(0);
  });

  it('refuses a line whose size and choices add up to zero — item_unpriced', () => {
    expect(() => reprice([line('p-zero', ['o-free'])])).toThrow(expect.objectContaining({
      statusCode: 400, code: 'item_unpriced',
    }));
  });

  it('refuses the whole order even when a real item rides with a zero one', () => {
    expect(() => reprice([{ ...line(real.id), sizeId: real.sizes[0]!.id }, line('p-zero')]))
      .toThrow(expect.objectContaining({ code: 'item_unpriced' }));
  });

  it('refuses an order a 100% discount would make free — order_total_zero', () => {
    expect(() => reprice([{ ...line(real.id), sizeId: real.sizes[0]!.id }], (subtotal) => subtotal))
      .toThrow(expect.objectContaining({ statusCode: 400, code: 'order_total_zero' }));
  });

  it('every item on the shipped menu, in its cheapest configuration, costs more than zero', () => {
    for (const m of menuItems.filter((x) => x.id !== 'p-zero')) {
      const cheapest = Math.min(...m.sizes.map((z) => z.price));
      expect(cheapest, m.nameEn).toBeGreaterThan(0);
      for (const g of m.customizations) for (const o of g.options) expect(o.priceDelta, `${m.nameEn}:${o.nameEn}`).toBeGreaterThanOrEqual(0);
    }
  });
});
