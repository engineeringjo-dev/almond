'use client';

import { useTranslations } from 'next-intl';
import { Bike, Coffee, Store } from 'lucide-react';
import type { OrderType } from '@almond/shared/types';
import { useCartStore } from '@/store/cartStore';
import { cn } from '@/lib/cn';

const TABS: { id: OrderType; Icon: typeof Store; key: string }[] = [
  { id: 'pickup', Icon: Store, key: 'pickup' },
  { id: 'dinein', Icon: Coffee, key: 'dinein' },
  { id: 'delivery', Icon: Bike, key: 'delivery' },
];

export function OrderTypeTabs() {
  const t = useTranslations('Checkout');
  const orderType = useCartStore((s) => s.orderType);
  const setOrderType = useCartStore((s) => s.setOrderType);

  return (
    <div className="grid grid-cols-3 gap-2">
      {TABS.map(({ id, Icon, key }) => (
        <button
          key={id}
          type="button"
          onClick={() => setOrderType(id)}
          className={cn(
            'flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors',
            orderType === id
              ? 'border-primary bg-accent-light text-primary'
              : 'border-neutral-warm text-text-secondary hover:border-primary',
          )}
        >
          <Icon className="h-6 w-6" />
          <span className="text-sm font-bold">{t(key)}</span>
        </button>
      ))}
    </div>
  );
}
