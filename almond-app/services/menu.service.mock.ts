import type { MenuService } from './menu.service';
import { categories, menuItems } from './seed';
import { categoryRank } from '@/lib/menuOrder';
import { delay } from './util';

// Prepend an "All" chip so the menu filter can reset to the full list.
const ALL = { id: 'all', nameAr: 'الكل', nameEn: 'All' };

// Categories sorted "first things first" (drinks → food → desserts → merch).
const orderedCategories = [...categories].sort((a, b) => categoryRank(a.nameEn) - categoryRank(b.nameEn));
const rankById = new Map(categories.map((c) => [c.id, categoryRank(c.nameEn)]));
// Full item list grouped by the same category priority (so "All" leads with coffee).
const orderedItems = [...menuItems].sort(
  (a, b) => (rankById.get(a.categoryId) ?? 100) - (rankById.get(b.categoryId) ?? 100),
);

export const mockMenuService: MenuService = {
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
