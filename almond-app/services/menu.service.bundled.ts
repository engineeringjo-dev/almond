import type { MenuService } from './menu.service';
import { getMenu, type MenuState } from '@almond/shared/menu/store';
import { matchesMenuQuery, orderMenuItems, orderMenuSections } from '@almond/shared/menu/browse';
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
  // The website's order, from the one shared rule (menu/browse.ts): the
  // seasonal section, then drinks, food, sweets and the retail shelf, each
  // band led by what sells.
  const cats = orderMenuSections(categories, items);
  memo = { version, categories: cats, items: orderMenuItems(items, cats) };
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

  // The website's search (menu/browse.ts): both names, both descriptions.
  searchItems: (query) => delay(ordered().items.filter((i) => matchesMenuQuery(i, query))),
};
