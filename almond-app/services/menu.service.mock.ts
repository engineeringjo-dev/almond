import type { MenuService } from './menu.service';
import { categories, menuItems } from './seed';
import { delay } from './util';

// Prepend an "All" chip so the menu filter can reset to the full list.
const ALL = { id: 'all', nameAr: 'الكل', nameEn: 'All' };

export const mockMenuService: MenuService = {
  getCategories: () => delay([ALL, ...categories]),

  getItems: (categoryId) => {
    if (!categoryId || categoryId === 'all') return delay(menuItems);
    return delay(menuItems.filter((i) => i.categoryId === categoryId));
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
