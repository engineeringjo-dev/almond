import type { MenuService } from './menu.service';
import { categories, menuItems } from './seed';
import { categoryRank } from '@/lib/menuOrder';
import { delay } from './util';

/**
 * THE MENU — in every mode, demo and live alike. It is the shop's Odoo POS
 * menu (only items active on the POS), pulled with its photos, sizes, options
 * and the measured «إضافات» add-ons into packages/shared/src/menu, and synced
 * daily by .github/workflows/menu-sync.yml. The website and the public feed
 * read the same module, and the server re-prices every order from it.
 *
 * There used to be a separate "odoo" implementation that called Odoo from the
 * phone. It was never finished and would have shown the wrong menu on launch
 * (raw products, hidden ones included, no sizes, options or add-ons) — so it
 * was removed rather than switched on (GM, 2026-09-25).
 */

// Prepend an "All" chip so the menu filter can reset to the full list.
const ALL = { id: 'all', nameAr: 'الكل', nameEn: 'All' };

// Categories sorted "first things first" (drinks → food → desserts → merch).
const orderedCategories = [...categories].sort((a, b) => categoryRank(a.nameEn) - categoryRank(b.nameEn));
const rankById = new Map(categories.map((c) => [c.id, categoryRank(c.nameEn)]));
// Full item list grouped by the same category priority (so "All" leads with coffee).
const orderedItems = [...menuItems].sort(
  (a, b) => (rankById.get(a.categoryId) ?? 100) - (rankById.get(b.categoryId) ?? 100),
);

export const bundledMenuService: MenuService = {
  getCategories: () => delay([ALL, ...orderedCategories]),

  getItems: (categoryId) => {
    if (!categoryId || categoryId === 'all') return delay(orderedItems);
    return delay(orderedItems.filter((i) => i.categoryId === categoryId));
  },

  getItem: (id) => {
    const item = menuItems.find((i) => i.id === id);
    if (!item) return Promise.reject(new Error(`Item ${id} not found`));
    return delay(item);
  },

  searchItems: (query) => {
    const q = query.trim().toLowerCase();
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
