import type { MenuItem } from '@almond/shared/types';
import { menuItems } from '@almond/shared/menu';

/**
 * A demoable "most loved" set: in-stock items that have a real photo, spread
 * across the menu for visual variety. Deterministic (no Math.random) so server
 * and client render the same order — no hydration mismatch.
 */
export function getFeaturedItems(limit = 10): MenuItem[] {
  const withPhotos = menuItems.filter((i) => i.imageUrl && i.inStock !== false);
  if (withPhotos.length <= limit) return withPhotos;

  const step = Math.floor(withPhotos.length / limit);
  const picked: MenuItem[] = [];
  for (let i = 0; i < withPhotos.length && picked.length < limit; i += step) {
    picked.push(withPhotos[i]);
  }
  return picked;
}
