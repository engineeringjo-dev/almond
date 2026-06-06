import type { Metadata } from 'next';
import { OrderSuccessView } from '@/components/checkout/OrderSuccessView';

export const metadata: Metadata = { title: 'Order received' };

export default function CheckoutSuccessPage() {
  return <OrderSuccessView />;
}
