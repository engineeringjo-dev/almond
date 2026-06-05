import type { IconName } from '@/components/ui/Icon';
import { menuItems } from '@/services/seed';
import { categoryGroup, type CategoryGroup } from '@/lib/categoryKind';

/**
 * Unified product/category icons (Revision Pack §M) — one consistent line-icon
 * family, no broken/colored emoji. Icons are chosen by the category's group,
 * which is derived from its name (works with the live Talabat menu IDs).
 */
const GROUP_ICON: Record<CategoryGroup, IconName> = {
  coffee: 'coffee',
  cold: 'cold',
  matcha: 'matcha',
  chocolate: 'chocolate',
  tea: 'coffee',
  juice: 'cold',
  pastry: 'pastries',
  cake: 'cake',
  dessert: 'cake',
  savory: 'brunch',
  salad: 'brunch',
  beans: 'bean',
  gift: 'gift',
  other: 'coffee',
};

export function iconForCategory(categoryId: string): IconName {
  if (categoryId === 'all') return 'coffee';
  return GROUP_ICON[categoryGroup(categoryId)] ?? 'coffee';
}

export function iconForItem(itemId: string): IconName {
  const item = menuItems.find((i) => i.id === itemId);
  return item ? iconForCategory(item.categoryId) : 'coffee';
}
