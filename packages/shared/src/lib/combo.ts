import { itemKind } from './categoryKind';
import { lineUnitPrice } from '../cart/totals';
import type { CartItem } from '../types';
import type { ComboBasket, ComboUnit } from '../loyalty/earn';

/**
 * Drink + food combo bonus (replaces the old brunch price discount).
 *
 * This module COUNTS pairs (`comboPairs` — 2 drinks + 2 foods = 2 pairs;
 * 2 drinks + 1 food = 1 pair — what the banner and the offer card read) and
 * LISTS the priced candidates (`comboBasket` — what the earn engine chooses the
 * pair from). Classification is by category name (see categoryKind).
 *
 * What a pair is WORTH is not decided here — `loyalty/earn.ts` pays a pair
 * config.COMBO_BONUS_POINTS INSTEAD of the pair's regular points (owner,
 * 2026-09-24), picks which pair, and is the only module that may
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
 * The drink and food lines of a basket, priced for the combo — what
 * `computeEarn` chooses the pair from (EarnContext.combo).
 *
 * 🔴 WHY PRICES AND NOT A COUNT. Owner, 2026-09-24: the combo's points REPLACE
 * the pair's regular points instead of being added on top. So the engine must
 * know what the pair COST, to take it out of the regular base — a bare pair
 * count (what `comboPairs` returns) cannot say that. Which pair is taken (the
 * cheapest drink unit and the cheapest food unit) is decided in loyalty/earn.ts,
 * next to the cap on pairs per invoice; this only lists the candidates.
 *
 * `invoiceTotal` puts each unit on the SAME basis as `EarnContext.total`: the
 * menu price scaled by `invoiceTotal / subtotal`, i.e. the unit's share of any
 * invoice-level discount (a promo, a corporate percentage) and of tax when
 * prices are tax-exclusive. With the shipped tax-inclusive prices and no
 * discount the factor is exactly 1. Omitted, units carry their menu price.
 *
 * Classification is `itemKind`, the same classifier `comboPairs` uses — one
 * classifier, so the count the banner shows and the pair the engine pays can
 * never disagree.
 */
export function comboBasket(items: CartItem[], invoiceTotal?: number): ComboBasket {
  const subtotal = items.reduce((s, l) => s + lineUnitPrice(l) * l.qty, 0);
  const scale = invoiceTotal !== undefined && subtotal > 0 ? Math.max(0, invoiceTotal) / subtotal : 1;
  const drinks: ComboUnit[] = [];
  const foods: ComboUnit[] = [];
  for (const l of items) {
    const k = itemKind(l.itemId);
    const unit: ComboUnit = { unitJod: lineUnitPrice(l) * scale, qty: l.qty };
    if (k === 'drink') drinks.push(unit);
    else if (k === 'food') foods.push(unit);
  }
  return { drinks, foods };
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
