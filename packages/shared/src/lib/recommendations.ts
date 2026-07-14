import { menuItems } from '../menu/seed';
import { categoryKind, itemKind, type CategoryKind } from './categoryKind';
import type { MenuItem, CartItem, ItemSize } from '../types';

/**
 * Rule-based upsell / cross-sell engine (Starbucks-style).
 *
 * Categories are classified as drink / food / other by name (see categoryKind),
 * so cross-sell keeps working with the live Talabat menu (opaque `sec-…` IDs).
 * Swap for real "frequently bought together" data from Odoo/loyalty later.
 */

// "Treat" foods pair best with coffee; popular drinks pair best with food.
const TREAT = /croissant|cake|cookie|brownie|muffin|cheesecake|tart|donut|waffle|dessert|sweet|pie|كرواسون|كروسان|كيك|كوكي|حلو|براوني|مافن/i;
const POPULAR_DRINK = /latte|cappuccino|americano|mocha|frapp|coffee|لاتيه|كابتشينو|قهوة|موكا|فرابيه/i;

// Lower sorts first: treats / popular drinks, then items that have a photo.
function pairScore(m: MenuItem): number {
  const k = categoryKind(m.categoryId);
  const hay = m.nameEn || '';
  let s = 0;
  if (k === 'food' && TREAT.test(hay)) s -= 10;
  if (k === 'drink' && POPULAR_DRINK.test(hay)) s -= 10;
  if (m.imageUrl) s -= 1;
  return s;
}

function pickByKind(target: CategoryKind, exclude: Set<string>, max: number): MenuItem[] {
  return menuItems
    .filter((m) => categoryKind(m.categoryId) === target && !exclude.has(m.id) && m.inStock !== false)
    .sort((a, b) => pairScore(a) - pairScore(b))
    .slice(0, max);
}

/**
 * Cross-sell for the cart: complete the order. Drinks → suggest food, food →
 * suggest a drink, mixed cart → food treats. Excludes items already in the cart.
 */
export function getCartCrossSell(items: CartItem[], max = 8): MenuItem[] {
  if (items.length === 0) return [];
  const inCart = new Set(items.map((i) => i.itemId));
  const kinds = items.map((i) => itemKind(i.itemId));
  const hasDrink = kinds.includes('drink');
  const hasFood = kinds.includes('food');

  // Drink-only cart → suggest food; food-only → suggest drinks; otherwise food.
  const target: CategoryKind = hasDrink && !hasFood ? 'food' : hasFood && !hasDrink ? 'drink' : 'food';
  return pickByKind(target, inCart, max);
}

/**
 * Brunch combo nudge — disabled for the live (Talabat) menu, whose items don't
 * carry the isBrunch flag the combo discount relies on. Re-enable once the
 * combo rule + flags are defined for the real categories.
 */
export function getBrunchCrossSell(_items: CartItem[]): MenuItem | null {
  return null;
}

/**
 * Drink + food combo upsell (bidirectional): adding the missing half earns the
 * +50-point combo bonus (see lib/combo.ts).
 * - drink in cart, no food → suggest food.
 * - food in cart, no drink → suggest a drink.
 * Returns the suggested item + which half is missing, or null.
 */
export function getComboUpsell(items: CartItem[]): { item: MenuItem; missing: 'drink' | 'food' } | null {
  if (items.length === 0) return null;
  const kinds = items.map((i) => itemKind(i.itemId));
  const hasDrink = kinds.includes('drink');
  const hasFood = kinds.includes('food');
  const inCart = new Set(items.map((i) => i.itemId));
  if (hasDrink && !hasFood) {
    const item = pickByKind('food', inCart, 1)[0];
    return item ? { item, missing: 'food' } : null;
  }
  if (hasFood && !hasDrink) {
    const item = pickByKind('drink', inCart, 1)[0];
    return item ? { item, missing: 'drink' } : null;
  }
  return null;
}

/** Cross-sell for the item modal: "goes great with" the item being viewed. */
export function getItemPairings(item: MenuItem, max = 4): MenuItem[] {
  // Drinks pair with food; food (or anything else) pairs with drinks.
  const target: CategoryKind = categoryKind(item.categoryId) === 'drink' ? 'food' : 'drink';
  return pickByKind(target, new Set([item.id]), max);
}

export interface SizeUpsell {
  size: ItemSize;
  delta: number; // price increase from the currently-selected size
}

/**
 * Upsell to a larger size. Returns the largest size + the price delta vs the
 * current selection, when a bigger size exists.
 */
export function getSizeUpsell(item: MenuItem, currentSizeId: ItemSize['id']): SizeUpsell | null {
  if (item.sizes.length < 2) return null;
  // Offer the NEXT size up (smaller price jump = higher accept rate), not the
  // largest outright.
  const byPrice = [...item.sizes].sort((a, b) => a.price - b.price);
  const current = byPrice.find((s) => s.id === currentSizeId) ?? byPrice[0];
  const next = byPrice.find((s) => s.price > current.price);
  if (!next) return null;
  return { size: next, delta: Math.max(0, next.price - current.price) };
}
