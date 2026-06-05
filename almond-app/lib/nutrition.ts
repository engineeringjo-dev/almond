import type { MenuItem } from '@/types';
import { categoryGroup, type CategoryGroup } from '@/lib/categoryKind';

export interface Nutrition {
  calories: number;
  sugarG: number;
  glutenFree: boolean;
}

/**
 * Approximate nutrition by category group (Almond cares about health/gluten).
 * Sensible estimates for display; TODO: replace with real per-item data from
 * Odoo. Baked goods contain gluten; drinks/salads are gluten-free.
 */
const BY_GROUP: Record<CategoryGroup, Nutrition> = {
  coffee: { calories: 120, sugarG: 9, glutenFree: true },
  cold: { calories: 150, sugarG: 14, glutenFree: true },
  matcha: { calories: 180, sugarG: 20, glutenFree: true },
  chocolate: { calories: 220, sugarG: 26, glutenFree: true },
  tea: { calories: 60, sugarG: 8, glutenFree: true },
  juice: { calories: 130, sugarG: 24, glutenFree: true },
  pastry: { calories: 320, sugarG: 12, glutenFree: false },
  cake: { calories: 380, sugarG: 30, glutenFree: false },
  dessert: { calories: 300, sugarG: 24, glutenFree: false },
  savory: { calories: 450, sugarG: 6, glutenFree: false },
  salad: { calories: 220, sugarG: 6, glutenFree: true },
  beans: { calories: 0, sugarG: 0, glutenFree: true },
  gift: { calories: 0, sugarG: 0, glutenFree: true },
  other: { calories: 150, sugarG: 10, glutenFree: true },
};

export function nutritionFor(item: MenuItem): Nutrition {
  return BY_GROUP[categoryGroup(item.categoryId)] ?? { calories: 150, sugarG: 10, glutenFree: true };
}
