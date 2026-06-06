import { itemKind } from '@/lib/categoryKind';
import { config } from '@/constants/config';
import type { CartItem } from '@/types';

/**
 * Drink + food combo bonus (replaces the old brunch price discount).
 *
 * Each drink paired with a food item earns the customer COMBO_BONUS_POINTS
 * (50 points = 0.5 JOD value). A cart with 2 drinks + 2 foods = 2 pairs = 100
 * points; 2 drinks + 1 food = 1 pair = 50. Classification is by category name
 * (see categoryKind), so it works with the live Talabat menu.
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

export function comboBonusPoints(items: CartItem[]): number {
  return comboPairs(items) * config.COMBO_BONUS_POINTS;
}
