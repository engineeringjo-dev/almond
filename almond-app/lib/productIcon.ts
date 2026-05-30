import type { IconName } from '@/components/ui/Icon';
import { menuItems } from '@/services/seed';

/**
 * Unified product/category icons (Revision Pack §M) — one consistent line-icon
 * family, no broken/colored emoji. Each category maps to one icon.
 */
const CATEGORY_ICON: Record<string, IconName> = {
  all: 'coffee',
  'hot-coffee': 'coffee',
  'cold-drinks': 'cold',
  matcha: 'matcha',
  chocolate: 'chocolate',
  pastries: 'pastries',
  cakes: 'cake',
  brunch: 'brunch',
  addons: 'addons',
};

export function iconForCategory(categoryId: string): IconName {
  return CATEGORY_ICON[categoryId] ?? 'coffee';
}

export function iconForItem(itemId: string): IconName {
  const item = menuItems.find((i) => i.id === itemId);
  return item ? iconForCategory(item.categoryId) : 'coffee';
}
