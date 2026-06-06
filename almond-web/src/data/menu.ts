import { categories, menuItems } from '@almond/shared/menu';
import type { Category, MenuItem } from '@almond/shared/types';
import { DATA_SOURCE } from '@/lib/config';

/**
 * Menu data access. Under `mock` (default) it reads the real Talabat menu from
 * the shared package; under `odoo` it will call the live API with the same
 * return shapes — flip DATA_SOURCE and nothing else changes for callers.
 */
export async function getMenu(): Promise<{ categories: Category[]; items: MenuItem[] }> {
  if (DATA_SOURCE === 'odoo') {
    throw new Error(
      'Odoo menu source is not wired yet — run with NEXT_PUBLIC_DATA_SOURCE=mock.',
    );
  }
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

/** Lowest size price for an item — used for "from X" labels. */
export function itemFromPrice(item: MenuItem): number {
  return item.sizes.reduce((min, s) => Math.min(min, s.price), Infinity);
}

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
  if (patch.price !== undefined && next.sizes.length > 0) {
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
