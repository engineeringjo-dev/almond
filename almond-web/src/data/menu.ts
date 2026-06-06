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
