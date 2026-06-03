import { menuItems } from '@/services/seed';
import type { MenuItem, CartItem, ItemSize } from '@/types';

/**
 * Rule-based upsell / cross-sell engine (Starbucks-style). With mock data we
 * don't have real "bought together" analytics, so we use category complements
 * plus a curated priority list. Swap for server/Odoo recommendations later.
 * TODO: replace with real "frequently bought together" data from Odoo/loyalty.
 */

const DRINK_CATS = ['hot-coffee', 'cold-drinks', 'matcha', 'chocolate'];
const FOOD_CATS = ['pastries', 'cakes', 'brunch'];

// Curated complement priority (best pairings first).
const PRIORITY = [
  'almond-croissant',
  'butter-croissant',
  'pain-au-chocolat',
  'cheesecake',
  'chocolate-cake',
  'cheese-croissant',
  'latte',
  'cappuccino',
  'cold-brew',
  'iced-latte',
  'matcha-iced',
  'extra-shot',
];

function catOf(itemId: string): string {
  return menuItems.find((m) => m.id === itemId)?.categoryId ?? '';
}

function rank(id: string): number {
  const i = PRIORITY.indexOf(id);
  return i === -1 ? PRIORITY.length : i;
}

function pickFrom(targetCats: string[], exclude: Set<string>, max: number): MenuItem[] {
  return menuItems
    .filter((m) => targetCats.includes(m.categoryId) && !exclude.has(m.id) && m.inStock !== false)
    .sort((a, b) => rank(a.id) - rank(b.id))
    .slice(0, max);
}

/**
 * Cross-sell for the cart: complete the order. Drinks → suggest food, food →
 * suggest a drink, mixed cart → desserts + add-ons. Excludes items already in
 * the cart.
 */
export function getCartCrossSell(items: CartItem[], max = 8): MenuItem[] {
  if (items.length === 0) return [];
  const inCart = new Set(items.map((i) => i.itemId));
  const cats = items.map((i) => catOf(i.itemId));
  const hasDrink = cats.some((c) => DRINK_CATS.includes(c));
  const hasFood = cats.some((c) => FOOD_CATS.includes(c));

  let targetCats: string[];
  if (hasDrink && !hasFood) targetCats = FOOD_CATS;
  else if (hasFood && !hasDrink) targetCats = DRINK_CATS;
  else targetCats = [...FOOD_CATS, 'addons'];

  return pickFrom(targetCats, inCart, max);
}

/**
 * Smart brunch combo cross-sell (§2.3 #3): when the cart has a drink but no
 * brunch (BR) item, suggest the best brunch dish — adding it triggers the
 * "drink + BR = -1.000 JOD" combo. Returns null when not applicable.
 */
export function getBrunchCrossSell(items: CartItem[]): MenuItem | null {
  if (items.length === 0) return null;
  const cats = items.map((i) => catOf(i.itemId));
  const hasDrink = cats.some((c) => DRINK_CATS.includes(c));
  const hasBrunch = items.some((i) => i.isBrunch) || cats.includes('brunch');
  if (!hasDrink || hasBrunch) return null;
  const inCart = new Set(items.map((i) => i.itemId));
  return pickFrom(['brunch'], inCart, 1)[0] ?? null;
}

/** Cross-sell for the item modal: "goes great with" the item being viewed. */
export function getItemPairings(item: MenuItem, max = 4): MenuItem[] {
  const isDrink = DRINK_CATS.includes(item.categoryId);
  const targetCats = isDrink ? FOOD_CATS : DRINK_CATS;
  return pickFrom(targetCats, new Set([item.id]), max);
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
  const current = item.sizes.find((s) => s.id === currentSizeId) ?? item.sizes[0];
  const largest = item.sizes.reduce((a, b) => (b.price > a.price ? b : a), item.sizes[0]);
  if (largest.id === current.id) return null;
  return { size: largest, delta: Math.max(0, largest.price - current.price) };
}
