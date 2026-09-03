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
