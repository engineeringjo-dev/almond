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
 * combo bonus — config.COMBO_BONUS_POINTS, priced in loyalty/earn.ts and named
 * nowhere else (see lib/combo.ts). The literal that used to stand here said
 * "+50-point" and was wrong for the two days the dial sat at 25.
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

/**
 * THE COLD-START PAIR — what a drink+food combo looks like to someone who has
 * not started an order.
 *
 * Every other function in this file needs a basket. `getComboUpsell` is
 * bidirectional but returns null on an empty cart by its first line, so the
 * combo bonus could only ever be surfaced to a member who had already half
 * earned it. That is why it lived in the cart and nowhere else, and why the
 * owner went looking for the offer on the offers page and could not find it
 * (2026-09-06).
 *
 * ── WHY A CONCRETE PAIR AND NOT A FILTERED MENU ─────────────────────────────
 *
 * A "combo-eligible items" filter is a no-op here. Counted over the shipped
 * menu: 267 items, 69 classify `drink` and 182 `food` (categoryKind), so 251 of
 * 267 — 94.0% — already qualify. Filtering removes 16 items and hands the
 * member back the menu they were already looking at. The offer is also
 * TWO-SIDED, and a filtered list shows one side of a pair at a time: it says
 * which items can pair, never which two do.
 *
 * ── WHY THE CHEAPEST OF THE WELL-RANKED CANDIDATES, NOT THE TOP-RANKED ──────
 *
 * `pairScore` alone returns Iced Ruby Latte (3.950) + Avocado & Nabulsi Cheese
 * Croissant (4.900) = 8.850 JOD, against a MEASURED member basket of 5.85 JOD.
 * The combo bonus is a FLAT grant — config.COMBO_BONUS_POINTS, the same number
 * on any pair — so its value as a share of the bill falls as the pair gets more
 * expensive, and the suggestion most likely to be taken is the one nearest the
 * basket the member already buys. Ranking by pairScore first and then taking
 * the cheapest of the top 12 gives Hot Americano (2.500) + Zaatar Croissant
 * (2.500) = 5.000 JOD: two archetypal items, just under the measured basket,
 * and at 50 points = 0.500 JOD that is 10.0% of the bill on top of the
 * cashback — the same arithmetic config/index.ts already works through on "a
 * 2.50 drink and a 1.90 cookie".
 *
 * ── WHY price > 0, WHEN IT DOES NOT BIND TODAY ──────────────────────────────
 *
 * 30 of the 267 items are priced 0.000 — price-on-request rows in the Talabat
 * export (the Mother's Day cakes and friends). 17 of them are food and score
 * −11, i.e. they TIE with the croissants that currently fill the candidate
 * window; the first one lands at rank 15 of 182 and is held out of the top 12
 * only by `Array#sort` being stable and the menu happening to list the
 * croissants first. So the guard changes nothing today and is three menu rows
 * from changing everything: without it, "cheapest" is a cake that costs nothing
 * — and a card whose whole claim is "you pay the FULL PRICE of both" cannot
 * suggest a half with no price to pay. It is also the only thing standing
 * between this function and a free item being advertised as an offer.
 *
 * Deterministic: the menu is static, the ranking is a total order and ties keep
 * the earlier (better-ranked) item, so this returns the same pair on every
 * device and in every process.
 */
export interface ComboStarter {
  drink: MenuItem;
  /** The cheapest PRICED size — the one the card's "add both" must add, or the
   *  suggestion would cost more than the reasoning that chose it. */
  drinkSize: ItemSize;
  food: MenuItem;
  foodSize: ItemSize;
}

/** How deep into the relevance ranking the price preference may reach. 12 is
 *  one screenful of cross-sell cards; beyond it the "goes with coffee" signal
 *  `pairScore` carries has run out and only price would be deciding. */
const STARTER_CANDIDATES = 12;

function cheapestPricedSize(m: MenuItem): ItemSize | null {
  let best: ItemSize | null = null;
  for (const s of m.sizes) {
    if (s.price > 0 && (best === null || s.price < best.price)) best = s;
  }
  return best;
}

function cheapestOfKind(kind: CategoryKind): { item: MenuItem; size: ItemSize } | null {
  let best: { item: MenuItem; size: ItemSize } | null = null;
  for (const item of pickByKind(kind, new Set<string>(), STARTER_CANDIDATES)) {
    const size = cheapestPricedSize(item);
    if (!size) continue;
    if (best === null || size.price < best.size.price) best = { item, size };
  }
  return best;
}

export function getComboStarter(): ComboStarter | null {
  const drink = cheapestOfKind('drink');
  const food = cheapestOfKind('food');
  if (!drink || !food) return null;
  return { drink: drink.item, drinkSize: drink.size, food: food.item, foodSize: food.size };
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
