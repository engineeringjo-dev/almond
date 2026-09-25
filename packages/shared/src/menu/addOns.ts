/**
 * ADD-ONS — Odoo's separate modifier products (Extra Cold Foam, Ice Cream…)
 * offered on the items customers actually add them to.
 *
 * GM, 2026-09-25: «ابني الموديفاير بشكل ادق واصح» (build the modifiers more
 * precisely and correctly).
 *
 * Odoo sells two kinds of extras:
 *   1. ATTRIBUTE choices on the product itself (Milk Type, Extra Drink…) —
 *      already in each item's `customizations` from the menu pull.
 *   2. MODIFIER PRODUCTS rung as their own line (POS categories 32–35, 38, 39).
 *      Odoo links them to no item. scripts/odoo-menu-insights.ts measures which
 *      item each one is added to (nearest preceding item of its own kind).
 *
 * This merges (2) into the item as one extra multi-choice group «إضافات», so
 * the app, the website, the public feed and the server's re-price (which
 * rebuilds every line from THIS menu) all see the same add-ons and prices —
 * nothing extra to wire, and a price can never come from the client.
 *
 * WHAT IS LEFT OUT, and why:
 *   - An add-on the item already offers as a choice (Extra Shot, Decaf, Ice
 *     Cream, Extra Nutella…): offering it twice would let one shot be charged
 *     twice. Matched on the name with "Extra", "1 Pump Of" and "Coffee" dropped.
 *   - A free add-on (a 0.001 "pump" is how the till prints a free flavour):
 *     a choice that costs nothing is an attribute choice, not an add-on.
 *   - Anything measured below the thresholds in the insights script.
 *
 * When an order reaches Odoo, an add-on is its own order line (product
 * `m-<template id>`), not an attribute value — see docs/PUBLIC-MENU-FEED.md.
 */
import type { MenuItem, CustomizationGroup } from '../types';

export const ADD_ONS_GROUP_ID = 'g-addons';

export interface AddOnProduct { id: string; nameEn: string; nameAr: string; price: number }
export interface AddOnLinks { modifiers: { modifierId: string; share: number }[] }

/** "Extra Decaf Coffee" and "Decaf", "1 Pump Of Caramel" and "Caramel" are the same thing. */
export function addOnKey(name: string): string {
  return name.toLowerCase()
    .replace(/\b(extra|1 pump of|pump of|coffee|only)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function attachAddOns(
  items: MenuItem[],
  products: AddOnProduct[],
  links: Record<string, AddOnLinks>,
): MenuItem[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  return items.map((item) => {
    const own = new Set(item.customizations.flatMap((g) => g.options.map((o) => addOnKey(o.nameEn))));
    const options = (links[item.id]?.modifiers ?? [])
      .map((l) => byId.get(l.modifierId))
      .filter((p): p is AddOnProduct => !!p && p.price > 0 && !own.has(addOnKey(p.nameEn)))
      .map((p) => ({ id: p.id, nameEn: p.nameEn, nameAr: p.nameAr, priceDelta: p.price }));
    if (!options.length) return item;
    const group: CustomizationGroup = {
      id: ADD_ONS_GROUP_ID, nameEn: 'Add-ons', nameAr: 'إضافات', multiple: true, options,
    };
    return { ...item, customizations: [...item.customizations, group] };
  });
}
