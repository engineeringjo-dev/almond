'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ShoppingBag } from 'lucide-react';
import { computeTotals } from '@almond/shared/cart';
import { getCartCrossSell } from '@almond/shared/lib/recommendations';
import { useCartStore } from '@/store/cartStore';
import { useLoyaltyStore } from '@/store/loyaltyStore';
import { asLang, formatNumber } from '@/lib/format';
import { CartLine } from './CartLine';
import { ComboBanner } from './ComboBanner';
import { CartSummary } from './CartSummary';
import { PromoInput } from './PromoInput';
import { MenuItemCard } from '@/components/menu/MenuItemCard';
import { Button } from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';

export function CartView() {
  const t = useTranslations('Cart');
  const lang = asLang(useLocale());
  const items = useCartStore((s) => s.items);
  const promoDiscount = useCartStore((s) => s.promoDiscount);
  const cup = useLoyaltyStore((s) => s.cup);

  // Cart lives in localStorage — render only after mount to avoid a mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const totals = useMemo(() => computeTotals(items, promoDiscount), [items, promoDiscount]);
  const crossSell = useMemo(() => getCartCrossSell(items, 4), [items]);

  if (!mounted) return <PageSkeleton />;

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
          <ComboBanner />
          {/* Free-drink progress nudge (drives AOV; ties loyalty to the cart). */}
          <div className="mb-6 rounded-lg bg-accent-light px-4 py-3">
            <p className="text-sm font-bold text-primary-dark">
              {cup.target - cup.current <= 0
                ? t('freeDrinkReady')
                : t('freeDrink', { n: formatNumber(cup.target - cup.current, lang) })}
            </p>
            <div
              className="mt-2 h-2 overflow-hidden rounded-pill bg-white/70"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={cup.target}
              aria-valuenow={cup.current}
              aria-label={t('freeDrink', { n: formatNumber(Math.max(0, cup.target - cup.current), lang) })}
            >
              <div
                className="h-full rounded-pill bg-primary"
                style={{ width: `${Math.min(100, (cup.current / cup.target) * 100)}%` }}
              />
            </div>
          </div>

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
