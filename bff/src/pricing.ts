import { menuItems } from '@almond/shared/menu';
import { computeTotals, buildLineId, type CartTotals } from '@almond/shared/cart';
import { basketHasDrink, comboPairs } from '@almond/shared/lib/combo';
import type { CartItem, CartCustomization } from '@almond/shared/types';
import { badRequest } from './http-error';
import type { CheckoutLine } from './backend/types';

/** The same subtotal `computeTotals` computes, exposed so a discount can be
 *  derived from it before that function is called. One definition: if these two
 *  ever disagreed, the discount would be a percentage of a different basket
 *  than the one being billed. */
function subtotalOf(items: CartItem[]): number {
  return computeTotals(items, 0).subtotal;
}

/** Server-authoritative re-pricing: rebuild every line from the shared menu so
 *  prices, sizes and modifier deltas can never be forged by the client. */
export function reprice(lines: CheckoutLine[], discountFor?: (subtotal: number) => number): {
  items: CartItem[];
  totals: CartTotals;
  /** Drink+food pairs. Pricing counts pairs; loyalty/earn.ts prices them. */
  comboPairs: number;
  /** Does the basket contain a drink? The second-visit voucher's condition —
   *  classified by itemKind, so a 250 g retail bag of beans is not a drink even
   *  though it carries `isDrink: true` (lib/combo.ts). Computed here so the
   *  route never touches the menu. */
  hasDrink: boolean;
} {
  if (!Array.isArray(lines) || lines.length === 0) throw badRequest('empty cart');
  const items: CartItem[] = lines.map((l) => {
    const item = menuItems.find((m) => m.id === l.itemId);
    if (!item) throw badRequest(`unknown item: ${l.itemId}`);
    if (item.inStock === false) throw badRequest(`out of stock: ${l.itemId}`);
    const size = item.sizes.find((s) => s.id === l.sizeId) ?? item.sizes[0];
    const customizations: CartCustomization[] = (l.optionIds ?? []).map((optId) => {
      for (const g of item.customizations) {
        const opt = g.options.find((o) => o.id === optId);
        if (opt) return { groupId: g.id, optionId: opt.id, nameAr: opt.nameAr, nameEn: opt.nameEn, priceDelta: opt.priceDelta };
      }
      throw badRequest(`unknown option ${optId} for ${l.itemId}`);
    });
    const qty = Math.max(1, Math.floor(l.qty || 1));
    return {
      lineId: buildLineId(item.id, size.id, customizations),
      itemId: item.id, nameAr: item.nameAr, nameEn: item.nameEn, emoji: item.emoji,
      sizeId: size.id, sizeNameAr: size.nameAr, sizeNameEn: size.nameEn,
      unitBasePrice: size.price, customizations, qty,
      isBrunch: item.isBrunch, isDrink: item.isDrink,
    };
  });
  return {
    items,
    /**
     * The discount goes through `computeTotals`' EXISTING slot rather than
     * being subtracted afterwards, because that slot is applied BEFORE tax
     * (`taxable = subtotal - discount`). A corporate discount subtracted from
     * the total instead would charge 16% tax on money the member never paid.
     *
     * It is a callback because the amount depends on the subtotal, which is
     * computed here — the caller knows the PERCENTAGE, this knows the base.
     */
    totals: computeTotals(items, discountFor ? discountFor(subtotalOf(items)) : 0),
    comboPairs: comboPairs(items),
    hasDrink: basketHasDrink(items),
  };
}
