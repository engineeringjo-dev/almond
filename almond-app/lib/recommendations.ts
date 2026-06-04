import { categories, menuItems } from '@/services/seed';
import type { MenuItem, CartItem, ItemSize, Category } from '@/types';

/**
 * Rule-based upsell / cross-sell engine (Starbucks-style).
 *
 * The live menu comes from the Talabat export, whose category IDs are opaque
 * (`sec-…`), so we can't hard-code them. Instead we classify each category as a
 * drink / food / other by its name (EN + AR keywords). This keeps cross-sell
 * working as the menu changes. Swap for real "frequently bought together" data
 * from Odoo/loyalty later.
 */

type Kind = 'drink' | 'food' | 'other';

// Beans, mugs, tools, gift boxes — never cross-sold as a drink/food pairing.
const OTHER_EN = /bean|mug|tool|tumbler|grinder|equipment|merch|gift/i;
const OTHER_AR = /حبوب|بنّ|أكواب|كوب|أدوات|طاحون|معدّات|معدات|هدية|هدايا/;
// Solid food (checked before drinks so "chocolate cake" → food, not drink).
const FOOD_EN =
  /croissant|sandwich|manaqeesh|manakish|pizza|pasta|meal|bagel|sourdough|bread|salad|granola|cake|dessert|sweet|m[a']?moul|cookie|muffin|tart|brownie|pastry|bakery|hotdog|wrap|cheesecake|donut|waffle|crepe|brunch|breakfast|bun|pie|keto/i;
const FOOD_AR =
  /كروسان|ساندويش|سندويش|مناقيش|بيتزا|باستا|معكرون|وجب|بيغل|بيجل|ساوردو|خبز|سلط|جرانولا|كيك|حلو|معمول|كوكي|مافن|تارت|براوني|معجن|مخبوز|بانكيك|بان كيك|فطور|كيتو|فطير/;
// Beverages.
const DRINK_EN =
  /coffee|latte|espresso|cappuccino|americano|mocha|frapp|tea|juice|mojito|lemonade|drink|chocolate|matcha|smoothie|shake|mocktail|soda|cola|milk/i;
const DRINK_AR =
  /قهوة|لاتيه|اسبريسو|إسبريسو|كابتشينو|أمريكانو|موكا|فرابيه|شاي|عصير|موهيتو|ليمون|مشروب|شوكولا|ماتشا|سموذي|حليب/;

// "Treat" foods pair best with coffee; popular drinks pair best with food.
const TREAT = /croissant|cake|cookie|brownie|muffin|cheesecake|tart|donut|waffle|dessert|sweet|pie|كرواسون|كروسان|كيك|كوكي|حلو|براوني|مافن/i;
const POPULAR_DRINK = /latte|cappuccino|americano|mocha|frapp|coffee|لاتيه|كابتشينو|قهوة|موكا|فرابيه/i;

function classify(c: Category): Kind {
  const en = c.nameEn || '';
  const ar = c.nameAr || '';
  if (OTHER_EN.test(en) || OTHER_AR.test(ar)) return 'other';
  if (FOOD_EN.test(en) || FOOD_AR.test(ar)) return 'food';
  if (DRINK_EN.test(en) || DRINK_AR.test(ar)) return 'drink';
  return 'other';
}

const catKind = new Map<string, Kind>();
const catNameEn = new Map<string, string>();
function ensureMaps() {
  if (catKind.size) return;
  for (const c of categories as Category[]) {
    catKind.set(c.id, classify(c));
    catNameEn.set(c.id, c.nameEn || '');
  }
}

function kindOfCat(catId: string): Kind {
  ensureMaps();
  return catKind.get(catId) ?? 'other';
}

function kindOfItem(itemId: string): Kind {
  const it = menuItems.find((m) => m.id === itemId);
  return it ? kindOfCat(it.categoryId) : 'other';
}

// Lower sorts first: treats / popular drinks, then items that have a photo.
function pairScore(m: MenuItem): number {
  const k = kindOfCat(m.categoryId);
  const hay = `${m.nameEn || ''} ${catNameEn.get(m.categoryId) || ''}`;
  let s = 0;
  if (k === 'food' && TREAT.test(hay)) s -= 10;
  if (k === 'drink' && POPULAR_DRINK.test(hay)) s -= 10;
  if (m.imageUrl) s -= 1;
  return s;
}

function pickByKind(target: Kind, exclude: Set<string>, max: number): MenuItem[] {
  ensureMaps();
  return menuItems
    .filter((m) => kindOfCat(m.categoryId) === target && !exclude.has(m.id) && m.inStock !== false)
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
  const kinds = items.map((i) => kindOfItem(i.itemId));
  const hasDrink = kinds.includes('drink');
  const hasFood = kinds.includes('food');

  // Drink-only cart → suggest food; food-only → suggest drinks; otherwise food.
  const target: Kind = hasDrink && !hasFood ? 'food' : hasFood && !hasDrink ? 'drink' : 'food';
  return pickByKind(target, inCart, max);
}

/**
 * Brunch combo nudge — disabled for the live (Talabat) menu, whose items don't
 * carry the isDrink/isBrunch flags the combo discount relies on. Re-enable once
 * the combo rule + flags are defined for the real categories.
 */
export function getBrunchCrossSell(_items: CartItem[]): MenuItem | null {
  return null;
}

/** Cross-sell for the item modal: "goes great with" the item being viewed. */
export function getItemPairings(item: MenuItem, max = 4): MenuItem[] {
  const kind = kindOfCat(item.categoryId);
  // Drinks pair with food; food (or anything else) pairs with drinks.
  const target: Kind = kind === 'drink' ? 'food' : 'drink';
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
  const current = item.sizes.find((s) => s.id === currentSizeId) ?? item.sizes[0];
  const largest = item.sizes.reduce((a, b) => (b.price > a.price ? b : a), item.sizes[0]);
  if (largest.id === current.id) return null;
  return { size: largest, delta: Math.max(0, largest.price - current.price) };
}
