import { categories, menuItems } from '../menu/seed';
import type { Category } from '../types';

/**
 * Single source of truth for classifying menu categories.
 *
 * The live menu (Talabat export) has opaque category IDs (`sec-…`), so we
 * classify by the category NAME (EN + AR keywords). Everything that used to
 * switch on hard-coded category IDs — cross-sell, product icons, nutrition —
 * now goes through here so a menu change can't silently break them.
 */

export type CategoryKind = 'drink' | 'food' | 'other';

export type CategoryGroup =
  | 'coffee'
  | 'cold'
  | 'matcha'
  | 'chocolate'
  | 'tea'
  | 'juice'
  | 'pastry'
  | 'cake'
  | 'dessert'
  | 'savory'
  | 'salad'
  | 'beans'
  | 'gift'
  | 'other';

// Checked in order — most specific first (e.g. "Chocolate Cake" → cake, while
// "Hot Chocolate" → chocolate; "Coffee Beans" → beans, not coffee).
const RULES: { group: CategoryGroup; en: RegExp; ar: RegExp }[] = [
  { group: 'gift', en: /gift|box/i, ar: /هدية|هدايا|صندوق/ },
  { group: 'beans', en: /bean|mug|tool|tumbler|grinder|equipment|merch/i, ar: /حبوب|بنّ|أكواب|كوب|أدوات|طاحون|معدّات|معدات/ },
  { group: 'matcha', en: /matcha/i, ar: /ماتشا/ },
  { group: 'cake', en: /cake|cheesecake/i, ar: /كيك|تشيز/ },
  { group: 'dessert', en: /dessert|sweet|cookie|muffin|m[a']?moul|brownie|tart|granola|pie|donut|waffle|crepe|pudding/i, ar: /حلو|كوكي|مافن|معمول|براوني|تارت|جرانولا|فطير|دونات|وافل|كريب/ },
  { group: 'pastry', en: /croissant|pastry|bakery|bun/i, ar: /كروسان|كرواسون|معجن|مخبوز/ },
  { group: 'salad', en: /salad/i, ar: /سلط/ },
  { group: 'savory', en: /pizza|manaqeesh|manakish|sandwich|meal|pasta|hotdog|wrap|sourdough|bread|bagel|keto|breakfast|brunch/i, ar: /بيتزا|مناقيش|ساندويش|سندويش|وجب|معكرون|باستا|ساوردو|خبز|بيغل|بيجل|كيتو|فطور|برانش/ },
  { group: 'tea', en: /\btea\b/i, ar: /شاي/ },
  { group: 'juice', en: /juice|lemonade|mojito|mocktail|smoothie|\bsoda\b|\bcola\b/i, ar: /عصير|ليمون|موهيتو|سموذي/ },
  { group: 'chocolate', en: /chocolate|cocoa/i, ar: /شوكولا|كاكاو/ },
  { group: 'coffee', en: /coffee|latte|espresso|cappuccino|americano|mocha|cortado|macchiato|flat white|frapp/i, ar: /قهوة|لاتيه|اسبريسو|إسبريسو|كابتشينو|أمريكانو|موكا|كورتادو|ماكياتو|فرابيه/ },
  { group: 'cold', en: /iced|cold|frozen|shake|drink/i, ar: /بارد|مثلج|آيس|أيس|شيك|مشروب/ },
];

const FOOD_GROUPS = new Set<CategoryGroup>(['pastry', 'cake', 'dessert', 'savory', 'salad']);
const DRINK_GROUPS = new Set<CategoryGroup>(['coffee', 'cold', 'matcha', 'chocolate', 'tea', 'juice']);

function classify(c: Category): CategoryGroup {
  const en = c.nameEn || '';
  const ar = c.nameAr || '';
  for (const r of RULES) {
    if (r.en.test(en) || r.ar.test(ar)) return r.group;
  }
  return 'other';
}

const groupById = new Map<string, CategoryGroup>();
function ensureMap() {
  if (groupById.size) return;
  for (const c of categories as Category[]) groupById.set(c.id, classify(c));
}

/** Finer group used for icons + nutrition. */
export function categoryGroup(categoryId: string): CategoryGroup {
  ensureMap();
  return groupById.get(categoryId) ?? 'other';
}

/** Coarse drink / food / other used for cross-sell. */
export function categoryKind(categoryId: string): CategoryKind {
  const g = categoryGroup(categoryId);
  if (FOOD_GROUPS.has(g)) return 'food';
  if (DRINK_GROUPS.has(g)) return 'drink';
  return 'other';
}

export function itemKind(itemId: string): CategoryKind {
  const it = menuItems.find((m) => m.id === itemId);
  return it ? categoryKind(it.categoryId) : 'other';
}
