import type { IconName } from '@/components/ui/Icon';
import type { PaymentMethodId } from '@/types';

/** Single-tone line icon per payment method (replaces colourful emoji). */
const MAP: Record<string, IconName> = {
  wallet: 'wallet',
  cliq: 'cliq',
  cash: 'cash',
  visa: 'card',
  mastercard: 'card',
  paypal: 'card',
};

export function paymentIcon(id: PaymentMethodId | string): IconName {
  return MAP[id] ?? 'card';
}
