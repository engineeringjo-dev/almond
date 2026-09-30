import type { MenuService } from './menu.service';
import { getMenu, type MenuState } from '@almond/shared/menu/store';
import { categoryRank } from '@/lib/menuOrder';
import { delay } from './util';

/**
 * THE MENU — in every mode, demo and live alike. It is the shop's Odoo POS
 * menu (only items active on the POS), with its photos, sizes, options and the
 * measured «إضافات» add-ons. The app ships with it bundled and replaces it at
 * run time with the server's newer menu (services/menuSync.ts), so a menu change
 * reaches phones without a store release. Every call reads the menu in use NOW.
 *
 * There used to be a separate "odoo" implementation that called Odoo from the
 * phone. It was never finished and would have shown the wrong menu on launch
 * (raw products, hidden ones included, no sizes, options or add-ons) — so it
 * was removed rather than switched on (GM, 2026-09-25).
 */

// Prepend an "All" chip so the menu filter can reset to the full list.
const ALL = { id: 'all', nameAr: 'الكل', nameEn: 'All' };

// Ordering is recomputed only when the menu in use changes (keyed by version).
let memo: { version: string; categories: MenuState['categories']; items: MenuState['items'] } | null = null;
function ordered() {
  const { categories, items, version } = getMenu();
  if (memo?.version === version) return memo;
  // Categories sorted "first things first" (drinks → food → desserts → merch).
  const cats = [...categories].sort((a, b) => categoryRank(a.nameEn) - categoryRank(b.nameEn));
  const rankById = new Map(categories.map((c) => [c.id, categoryRank(c.nameEn)]));
  // Full item list grouped by the same category priority (so "All" leads with coffee).
  const sorted = [...items].sort(
    (a, b) => (rankById.get(a.categoryId) ?? 100) - (rankById.get(b.categoryId) ?? 100),
  );
  memo = { version, categories: cats, items: sorted };
  return memo;
}

export const bundledMenuService: MenuService = {
  getCategories: () => delay([ALL, ...ordered().categories]),

  getItems: (categoryId) => {
    const items = ordered().items;
    if (!categoryId || categoryId === 'all') return delay(items);
    return delay(items.filter((i) => i.categoryId === categoryId));
  },

  getItem: (id) => {
    const item = getMenu().items.find((i) => i.id === id);
    if (!item) return Promise.reject(new Error(`Item ${id} not found`));
    return delay(item);
  },

  searchItems: (query) => {
    const q = query.trim().toLowerCase();
    const menuItems = getMenu().items;
    if (!q) return delay(menuItems);
    return delay(
      menuItems.filter(
        (i) =>
          i.nameAr.toLowerCase().includes(q) ||
          i.nameEn.toLowerCase().includes(q) ||
          (i.descEn ?? '').toLowerCase().includes(q),
      ),
    );
  },
};
