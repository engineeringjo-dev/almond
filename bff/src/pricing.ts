import { menuItems } from '@almond/shared/menu';
import { computeTotals, buildLineId, type CartTotals } from '@almond/shared/cart';
import { comboBonusPoints } from '@almond/shared/lib/combo';
import type { CartItem, CartCustomization } from '@almond/shared/types';
import { badRequest } from './http-error';
import type { CheckoutLine } from './backend/types';

/** Server-authoritative re-pricing: rebuild every line from the shared menu so
 *  prices, sizes and modifier deltas can never be forged by the client. */
export function reprice(lines: CheckoutLine[]): {
  items: CartItem[];
  totals: CartTotals;
  comboBonus: number;
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
  return { items, totals: computeTotals(items, 0), comboBonus: comboBonusPoints(items) };
}
