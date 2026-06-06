'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ShoppingBag } from 'lucide-react';
import { computeTotals } from '@almond/shared/cart';
import { getCartCrossSell } from '@almond/shared/lib/recommendations';
import { useCartStore } from '@/store/cartStore';
import { CartLine } from './CartLine';
import { CartSummary } from './CartSummary';
import { PromoInput } from './PromoInput';
import { MenuItemCard } from '@/components/menu/MenuItemCard';
import { Button } from '@/components/ui/Button';

export function CartView() {
  const t = useTranslations('Cart');
  const items = useCartStore((s) => s.items);
  const promoDiscount = useCartStore((s) => s.promoDiscount);

  // Cart lives in localStorage — render only after mount to avoid a mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const totals = useMemo(() => computeTotals(items, promoDiscount), [items, promoDiscount]);
  const crossSell = useMemo(() => getCartCrossSell(items, 4), [items]);

  if (!mounted) return <div className="container-content min-h-[50vh] py-xl" />;

  if (items.length === 0) {
    return (
      <section className="container-content flex min-h-[60vh] flex-col items-center justify-center gap-5 py-xxl text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-pill bg-neutral-warm text-primary">
          <ShoppingBag className="h-7 w-7" />
        </span>
        <div className="space-y-1">
          <h1 className="text-xxl">{t('empty')}</h1>
          <p className="text-md text-text-secondary">{t('emptySubtitle')}</p>
        </div>
        <Button href="/menu" size="lg">
          {t('browseMenu')}
        </Button>
      </section>
    );
  }

  return (
    <div className="container-content py-xl">
      <h1 className="text-xxl">{t('title')}</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="divide-y divide-neutral-warm rounded-lg border border-neutral-warm bg-card px-4">
            {items.map((line) => (
              <CartLine key={line.lineId} line={line} />
            ))}
          </div>

          {crossSell.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg">{t('completeOrder')}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {crossSell.map((item) => (
                  <MenuItemCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="h-fit space-y-5 rounded-lg border border-neutral-warm bg-card p-5 shadow-card lg:sticky lg:top-20">
          <PromoInput />
          <CartSummary totals={totals} />
          <Button href="/checkout" size="lg" className="w-full">
            {t('checkout')}
          </Button>
        </aside>
      </div>
    </div>
  );
}
