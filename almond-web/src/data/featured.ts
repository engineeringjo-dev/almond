import type { MenuItem } from '@almond/shared/types';
import { bestSellers } from '@almond/shared/lib/recommendations';

/**
 * The row headed «الأكثر طلبًا»: the items customers order most, measured from
 * paid Odoo orders (bestSellers in @almond/shared, the app's rule too). It used
 * to be every Nth photographed item, which made the heading a claim about a
 * sample. Deterministic, so the server and the client render the same order.
 */
export function getFeaturedItems(limit = 10): MenuItem[] {
  return bestSellers(limit);
}
