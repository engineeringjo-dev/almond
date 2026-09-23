/**
 * Cart pricing — the single source of truth shared by the app and the website,
 * so a basket totals identically in both (sections 4.6, 5). Extracted verbatim
 * from the app's stores/cartStore.ts.
 */
import type { CartItem, CartCustomization } from '../types';
import { config } from '../config';

/** Build a stable line id from item + size + sorted customization option ids. */
export function buildLineId(
  itemId: string,
  sizeId: string,
  custs: CartCustomization[],
): string {
  const sig = custs
    .map((c) => `${c.groupId}:${c.optionId}`)
    .sort()
    .join('|');
  return `${itemId}__${sizeId}__${sig}`;
}

/** Unit price for a line including customization deltas. */
export function lineUnitPrice(line: CartItem): number {
  const extras = line.customizations.reduce((s, c) => s + c.priceDelta, 0);
  return line.unitBasePrice + extras;
}

/** Compute cart pricing including brunch combo + tax (sections 4.6, 5). */
export interface CartTotals {
  subtotal: number;
  brunchDiscount: number;
  promoDiscount: number;
  discount: number;
  tax: number;
  total: number;
}

export function computeTotals(items: CartItem[], promoDiscount: number): CartTotals {
  const subtotal = items.reduce((sum, l) => sum + lineUnitPrice(l) * l.qty, 0);

  // Brunch combo: one BR food per drink → -1.000 JOD each (section 5).
  const drinkQty = items.filter((l) => l.isDrink).reduce((s, l) => s + l.qty, 0);
  const brunchQty = items.filter((l) => l.isBrunch).reduce((s, l) => s + l.qty, 0);
  const combos = Math.min(drinkQty, brunchQty);
  const brunchDiscount = combos * config.BRUNCH_COMBO_DISCOUNT;

  // Discount stacking OFF (section 2.4): take the larger of brunch vs promo.
  const discount = Math.max(brunchDiscount, promoDiscount);

  const taxable = Math.max(0, subtotal - discount);
  const { tax, total } = applyTax(taxable);
  return { subtotal, brunchDiscount, promoDiscount, discount, tax, total };
}

/**
 * Tax on an amount the member is charged. With PRICES_TAX_INCLUSIVE the menu
 * price already CONTAINS the tax (as at the till): the total is the amount
 * itself and `tax` is the part of it that is tax — shown, never added. The
 * exclusive branch exists so the rule is one switch, not a code change.
 */
export function applyTax(amount: number): { tax: number; total: number } {
  if (config.PRICES_TAX_INCLUSIVE) {
    return { tax: amount - amount / (1 + config.TAX_RATE), total: amount };
  }
  const tax = amount * config.TAX_RATE;
  return { tax, total: amount + tax };
}

/** The rate as a whole-number percentage for labels ("8"), from the config. */
export const TAX_PERCENT = Math.round(config.TAX_RATE * 100);
