import type { MenuItem } from '@/types';

export interface Nutrition {
  calories: number;
  sugarG: number;
  glutenFree: boolean;
}

/**
 * Approximate nutrition by category (Almond cares about health/gluten). These
 * are sensible estimates for display; TODO: replace with real per-item data
 * from Odoo. Pastries/cakes/brunch contain gluten; drinks are gluten-free.
 */
const BY_CATEGORY: Record<string, Nutrition> = {
  'hot-coffee': { calories: 120, sugarG: 9, glutenFree: true },
  'cold-drinks': { calories: 150, sugarG: 14, glutenFree: true },
  matcha: { calories: 180, sugarG: 20, glutenFree: true },
  chocolate: { calories: 220, sugarG: 26, glutenFree: true },
  pastries: { calories: 320, sugarG: 12, glutenFree: false },
  cakes: { calories: 380, sugarG: 30, glutenFree: false },
  brunch: { calories: 450, sugarG: 6, glutenFree: false },
  addons: { calories: 50, sugarG: 3, glutenFree: true },
};

export function nutritionFor(item: MenuItem): Nutrition {
  return BY_CATEGORY[item.categoryId] ?? { calories: 150, sugarG: 10, glutenFree: true };
}
