/**
 * BROWSING THE MENU — the order of its sections and the search box, one
 * implementation for the app and the website (Dunkin' panel, 2026-10-15).
 *
 * ── THE ORDER ───────────────────────────────────────────────────────────────
 *
 * Measured before this module: the app opened on «فرابيه قهوة» (3.2% of
 * orders) because its priority table was keyed on the Talabat export's names
 * («Hot Specialty Coffee Drinks») and the Odoo menu says «Hot Specialty
 * Coffee», so the hot and iced specialty coffees — 33.6% of orders together —
 * fell to a keyword fallback behind the frappés. The website opened on
 * «ألواح» (0.3%), Odoo's own order, with the hot coffee 268 items down.
 *
 * Now: bands, then what sells. The seasonal section first while it has
 * items (a campaign is the reason to open the menu that week), then drinks,
 * food, sweets, the retail shelf, and last what is none of these. Inside a
 * band, the section that sold most in the measured window
 * (menu.insights.generated.ts) comes first; a tie keeps Odoo's order.
 *
 * Precedent: Starbucks (featured, then drinks, then food, then at-home
 * coffee), Dunkin' (campaign section first; «Brew at Home» and merchandise
 * last), Talabat and Careem (a restaurant's best-selling section first).
 *
 * ── THE SEARCH ─────────────────────────────────────────────────────────────
 *
 * Names and descriptions in both languages, the same everywhere: the app read
 * the English description only, the website both. Arabic is folded the way
 * people type it: «اسبريسو» finds «إسبريسو», «كيكه» finds «كيكة», and the
 * diacritics and the tatweel are ignored. Digits are Latin on the menu, so a
 * query typed in Arabic-Indic digits is read in Latin ones.
 */
import type { Category, MenuItem } from '../types';
import { groupOfCategory, type CategoryGroup } from '../lib/categoryKind';
import { toWesternDigits } from '../lib/phone';
import { itemInsights } from './menu.insights.generated';

export type MenuBand = 'seasonal' | 'drink' | 'food' | 'sweet' | 'retail' | 'other';

/** The bands, first to last. */
export const MENU_BANDS: readonly MenuBand[] = ['seasonal', 'drink', 'food', 'sweet', 'retail', 'other'];

const BAND_OF_GROUP: Readonly<Record<CategoryGroup, MenuBand>> = {
  coffee: 'drink',
  cold: 'drink',
  matcha: 'drink',
  chocolate: 'drink',
  tea: 'drink',
  juice: 'drink',
  savory: 'food',
  pastry: 'food',
  salad: 'food',
  cake: 'sweet',
  dessert: 'sweet',
  beans: 'retail',
  gift: 'retail',
  other: 'other',
};

const SEASONAL_EN = /season/i;
const SEASONAL_AR = /موسم/;

/** Which band a section belongs to, from its own names. */
export function menuBand(c: Pick<Category, 'nameEn' | 'nameAr'>): MenuBand {
  if (SEASONAL_EN.test(c.nameEn) || SEASONAL_AR.test(c.nameAr)) return 'seasonal';
  return BAND_OF_GROUP[groupOfCategory(c)];
}

/** Paid Odoo orders per section over the insight window. */
export function sectionOrders(items: readonly MenuItem[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const item of items) {
    out.set(item.categoryId, (out.get(item.categoryId) ?? 0) + (itemInsights[item.id]?.orders ?? 0));
  }
  return out;
}

/** The sections in menu order: by band, then by orders, then as Odoo has them. */
export function orderMenuSections<C extends Pick<Category, 'id' | 'nameEn' | 'nameAr'>>(
  categories: readonly C[],
  items: readonly MenuItem[],
): C[] {
  const orders = sectionOrders(items);
  const odooAt = new Map(categories.map((c, i) => [c.id, i] as const));
  const band = new Map(categories.map((c) => [c.id, MENU_BANDS.indexOf(menuBand(c))] as const));
  return [...categories].sort(
    (a, b) =>
      (band.get(a.id) ?? 0) - (band.get(b.id) ?? 0)
      || (orders.get(b.id) ?? 0) - (orders.get(a.id) ?? 0)
      || (odooAt.get(a.id) ?? 0) - (odooAt.get(b.id) ?? 0),
  );
}

/** Items in section order; inside a section, Odoo's order (the sort is stable). */
export function orderMenuItems<I extends Pick<MenuItem, 'categoryId'>>(
  items: readonly I[],
  orderedCategories: readonly Pick<Category, 'id'>[],
): I[] {
  const rank = new Map(orderedCategories.map((c, i) => [c.id, i] as const));
  const last = orderedCategories.length;
  return [...items].sort((a, b) => (rank.get(a.categoryId) ?? last) - (rank.get(b.categoryId) ?? last));
}

// Harakat (U+064B–U+065F), the superscript alef (U+0670) and the tatweel (U+0640).
const MARKS = /[ً-ٰٟـ]/g;

/** Text as a search compares it: Latin digits, lower case, Arabic folded. */
export function foldForSearch(text: string): string {
  return toWesternDigits(text)
    .toLowerCase()
    .replace(MARKS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Does this item answer the query? An empty query matches everything. */
export function matchesMenuQuery(
  item: Pick<MenuItem, 'nameAr' | 'nameEn' | 'descAr' | 'descEn'>,
  query: string,
): boolean {
  const q = foldForSearch(query);
  if (!q) return true;
  return [item.nameAr, item.nameEn, item.descAr, item.descEn].some((field) => !!field && foldForSearch(field).includes(q));
}
