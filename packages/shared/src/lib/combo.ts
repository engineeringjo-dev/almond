import { itemKind } from './categoryKind';
import type { CartItem } from '../types';

/**
 * Drink + food combo bonus (replaces the old brunch price discount).
 *
 * This module counts PAIRS only. A cart with 2 drinks + 2 foods = 2 pairs;
 * 2 drinks + 1 food = 1 pair. Classification is by category name (see
 * categoryKind), so it works with the live Talabat menu.
 *
 * What a pair is WORTH is not decided here — `loyalty/earn.ts` prices pairs at
 * config.COMBO_BONUS_POINTS, and it is the only module that may
 * (docs/LOYALTY-EARN-PATCH.md §3.5).
 *
 * Single source of truth — both the website and the app use this.
 */
export function comboPairs(items: CartItem[]): number {
  let drink = 0;
  let food = 0;
  for (const l of items) {
    const k = itemKind(l.itemId);
    if (k === 'drink') drink += l.qty;
    else if (k === 'food') food += l.qty;
  }
  return Math.min(drink, food);
}

/**
 * Does this basket contain a drink? The condition on the second-visit voucher
 * (`config.SECOND_VISIT_VOUCHER.requiresDrink`).
 *
 * 🔴 `itemKind`, NOT `item.isDrink`, and the difference is 14 items. Counted
 * over the shipped menu: 267 items, 83 carry `isDrink === true`, 69 classify as
 * `itemKind === 'drink'`, and the 69 are a strict SUBSET of the 83. The 14
 * extras are seven 250 g retail bags of specialty coffee, a Hario V60 dripper,
 * a V60 craft maker, V60 PAPER FILTERS, three granola cups and a chia pudding —
 * every one of them in a `beans` category. `item.isDrink` would issue "the
 * second one's on us" on a pack of paper filters. `itemKind` is also already
 * what comboPairs uses, so this repo has one classifier rather than two that
 * happen to agree today.
 *
 * It lives HERE and not in loyalty/secondVisit.ts because `itemKind` pulls
 * menu/seed → menu.generated.ts (543,502 bytes) and the loyalty barrel is
 * imported by almond-app; combo.ts already carries that dependency and is
 * already imported by bff/src/pricing.ts.
 */
export function basketHasDrink(items: CartItem[]): boolean {
  return items.some((l) => itemKind(l.itemId) === 'drink' && l.qty > 0);
}
