import type { IconName } from '@/components/ui/Icon';
import type { OrderStatus } from '@/types';

/**
 * One line icon per order state — the track list and the status timeline say
 * it the same way. They were four emoji (🧾 ☕ ✅ 🎉) in two copies; the icon
 * set is one line family and the identity has no colour (owner, 2026-10-15:
 * «الغي البنفسجي والايموجي»).
 */
export const STATUS_ICON: Record<OrderStatus, IconName> = {
  received: 'receipt',
  preparing: 'coffee',
  ready: 'circle-check',
  completed: 'package-check',
  cancelled: 'close',
};
