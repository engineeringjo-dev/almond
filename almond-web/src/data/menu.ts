import { categories, menuItems } from '@almond/shared/menu';
import type { Category, MenuItem } from '@almond/shared/types';

/**
 * Menu data access — ONE menu in every mode. It is the shop's Odoo POS menu
 * (only items active on the POS, with sizes, options and the measured «إضافات»
 * add-ons), pulled into @almond/shared and re-synced daily by
 * .github/workflows/menu-sync.yml; the app, the public feed and the server's
 * re-price read the same module.
 *
 * Under 'odoo' this used to THROW, because the bundled menu was then a stale
 * Talabat export. It no longer is (GM, 2026-09-25), so live mode serves it too.
 */
export async function getMenu(): Promise<{ categories: Category[]; items: MenuItem[] }> {
  return { categories, items: menuItems };
}

export function getAllItems(): MenuItem[] {
  return menuItems;
}

export function getAllCategories(): Category[] {
  return categories;
}

export function getItemById(id: string): MenuItem | undefined {
  return menuItems.find((item) => item.id === id);
}

/** The least a member can actually pay — size floor PLUS any mandatory
 *  single-choice group. Lives in @almond/shared so the app and the website
 *  quote one number; this local `min(sizes)` advertised «من ٠٫٠٠٠ د.أ» for the
 *  thirty items the export prices entirely through a required modifier. */
export { itemFromPrice } from '@almond/shared/menu';

export interface CategorySection {
  category: Category;
  items: MenuItem[];
}

/** Menu grouped by category (only categories that have items), in menu order. */
export function getMenuSections(): CategorySection[] {
  const byCategory = new Map<string, MenuItem[]>();
  for (const item of menuItems) {
    const list = byCategory.get(item.categoryId) ?? [];
    list.push(item);
    byCategory.set(item.categoryId, list);
  }
  return categories
    .map((category) => ({ category, items: byCategory.get(category.id) ?? [] }))
    .filter((section) => section.items.length > 0);
}

/**
 * Admin menu edits (mock layer). Stored as a per-item overlay on top of the
 * shared menu so changes show on the website immediately. Under
 * DATA_SOURCE='odoo' these writes go to Odoo — the single source both the
 * website and the app read, so a menu edit reflects on the app too.
 */
export interface ItemPatch {
  price?: number; // overrides the base (first) size price
  inStock?: boolean;
  hidden?: boolean;
  nameAr?: string;
  nameEn?: string;
}

export function applyItemPatch(item: MenuItem, patch?: ItemPatch): MenuItem {
  if (!patch) return item;
  let next: MenuItem = item;
  if (patch.inStock !== undefined) next = { ...next, inStock: patch.inStock };
  if (patch.nameAr) next = { ...next, nameAr: patch.nameAr };
  if (patch.nameEn) next = { ...next, nameEn: patch.nameEn };
  // Only a real price reaches the menu. The editor's `Number(field)` turns a
  // cleared box into 0 and garbage into NaN; either would publish the item at
  // 0.000 or "NaN" JOD. Zero itself stays allowed — a free item is a decision.
  if (
    typeof patch.price === 'number' &&
    Number.isFinite(patch.price) &&
    patch.price >= 0 &&
    next.sizes.length > 0
  ) {
    next = {
      ...next,
      sizes: next.sizes.map((s, i) => (i === 0 ? { ...s, price: patch.price as number } : s)),
    };
  }
  return next;
}

/** Apply all admin edits to a list, dropping items marked hidden. */
export function applyOverlay(items: MenuItem[], edits: Record<string, ItemPatch>): MenuItem[] {
  return items.filter((it) => !edits[it.id]?.hidden).map((it) => applyItemPatch(it, edits[it.id]));
}

/** Free-text search across AR/EN names + descriptions. */
export function searchItems(query: string): MenuItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return menuItems.filter((item) =>
    [item.nameAr, item.nameEn, item.descAr, item.descEn].some((field) =>
      field?.toLowerCase().includes(q),
    ),
  );
}
