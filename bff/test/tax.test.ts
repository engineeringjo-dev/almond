import { describe, it, expect } from 'vitest';
import { config } from '@almond/shared/config';
import { applyTax, computeTotals, TAX_PERCENT } from '@almond/shared/cart';
import { menuItems } from '@almond/shared/menu';
import type { CartItem } from '@almond/shared/types';

/**
 * TX — ONLINE COSTS WHAT THE COUNTER COSTS.
 *
 * The menu is Odoo's list_price, the shop's own price, and Almond's POS taxes
 * every sale at 8% INSIDE that price. The site used to ADD 16% on top — a
 * spec assumption from the Talabat-export era — so a basket cost 16% more
 * online than at the counter, and earned 16% more points. These assert the
 * relationship, not a number someone copied: any item, any quantity, the
 * member pays the shop price.
 */
const line = (id: string, price: number, qty: number): CartItem => ({
  lineId: `${id}__M__`, itemId: id, nameAr: id, nameEn: id, emoji: '',
  sizeId: 'M', sizeNameAr: 'عادي', sizeNameEn: 'Regular',
  unitBasePrice: price, customizations: [], qty,
  isBrunch: false, isDrink: false,
});

describe('TX tax is inside the shop price', () => {
  it('is 8%, included — and the label reads the same number', () => {
    expect(config.TAX_RATE).toBe(0.08);
    expect(config.PRICES_TAX_INCLUSIVE).toBe(true);
    expect(TAX_PERCENT).toBe(8);
  });

  it('every real menu item, at 1 and at 3: the total IS the shop price', () => {
    let checked = 0;
    for (const item of menuItems) {
      for (const size of item.sizes) {
        if (!(size.price > 0)) continue;
        for (const qty of [1, 3]) {
          const t = computeTotals([line(item.id, size.price, qty)], 0);
          expect(t.total, `${item.id}/${size.id}×${qty}`).toBeCloseTo(size.price * qty, 9);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('the tax shown is the part of the price that is tax, and adds back up', () => {
    const { tax, total } = applyTax(10.8);
    expect(total).toBe(10.8);
    expect(tax).toBeCloseTo(0.8, 9);            // 10.80 = 10.00 net + 0.80 tax
    expect(total - tax).toBeCloseTo(10, 9);
  });

  it('a discount comes off BEFORE the tax is carved out, never after', () => {
    const t = computeTotals([line('x', 10, 1)], 4);
    expect(t.total).toBeCloseTo(6, 9);
    expect(t.tax).toBeCloseTo(6 - 6 / 1.08, 9);
  });
});
