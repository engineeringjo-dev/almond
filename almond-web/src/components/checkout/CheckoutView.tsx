'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Banknote, CreditCard, Lock, Smartphone, Sparkles, Truck, Wallet } from 'lucide-react';
import { computeTotals } from '@almond/shared/cart';
import { getCartCrossSell } from '@almond/shared/lib/recommendations';
import { getBranches } from '@/data/branches';
import { MenuItemCard } from '@/components/menu/MenuItemCard';
import { createMockOrder, estimatedBeans } from '@/data/order';
import { useCartStore } from '@/store/cartStore';
import { useOrderStore } from '@/store/orderStore';
import { useRouter } from '@/i18n/navigation';
import { DELIVERY_ETA, DELIVERY_FEE, dispatchDelivery } from '@/data/delivery';
import { payForOrder } from '@/data/payment';
import { asLang, formatJOD } from '@/lib/format';
import { OrderTypeTabs } from './OrderTypeTabs';
import { BranchPicker } from './BranchPicker';
import { PaymentMethods } from './PaymentMethods';
import { CartSummary } from '@/components/cart/CartSummary';
import { Button } from '@/components/ui/Button';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-lg">{children}</h2>;
}

export function CheckoutView() {
  const t = useTranslations('Checkout');
  const tc = useTranslations('Cart');
  const lang = asLang(useLocale());
  const router = useRouter();

  const items = useCartStore((s) => s.items);
  const orderType = useCartStore((s) => s.orderType);
  const branchId = useCartStore((s) => s.branchId);
  const paymentMethod = useCartStore((s) => s.paymentMethod);
  const paidFromBalance = useCartStore((s) => s.paidFromBalance);
  const promoCode = useCartStore((s) => s.promoCode);
  const promoDiscount = useCartStore((s) => s.promoDiscount);
  const curbside = useCartStore((s) => s.curbside);
  const carInfo = useCartStore((s) => s.carInfo);
  const deliveryAddress = useCartStore((s) => s.deliveryAddress);
  const setDeliveryAddress = useCartStore((s) => s.setDeliveryAddress);
  const clear = useCartStore((s) => s.clear);
  const setLastOrder = useOrderStore((s) => s.setLastOrder);

  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => setMounted(true), []);

  const totals = useMemo(() => computeTotals(items, promoDiscount), [items, promoDiscount]);
  const crossSell = useMemo(() => getCartCrossSell(items, 2), [items]);
  const beans = estimatedBeans(totals.total);
  const isDelivery = orderType === 'delivery';

  if (!mounted) return <div className="container-content min-h-[50vh] py-xl" />;

  if (items.length === 0) {
    return (
      <section className="container-content flex min-h-[60vh] flex-col items-center justify-center gap-5 py-xxl text-center">
        <h1 className="text-xxl">{t('title')}</h1>
        <Button href="/menu" size="lg">
          {tc('browseMenu')}
        </Button>
      </section>
    );
  }

  const place = () => {
    if (!branchId || (isDelivery && !deliveryAddress.trim())) {
      setError(true);
      return;
    }
    const branch = getBranches().find((b) => b.id === branchId) ?? null;
    const order = createMockOrder({
      items,
      totals,
      orderType,
      branch,
      paymentMethod,
      paidFromBalance,
      promoCode,
      curbside,
      carInfo,
      deliveryAddress: isDelivery ? deliveryAddress.trim() : undefined,
      deliveryFee: isDelivery ? DELIVERY_FEE : 0,
    });
    if (isDelivery) void dispatchDelivery(order); // mock dispatch via Ishbek seam
    if (paymentMethod !== 'cash') void payForOrder(order); // secure payment seam
    setLastOrder(order);
    clear();
    router.push('/checkout/success');
  };

  return (
    <div className="container-content py-xl">
      <h1 className="text-xxl">{t('title')}</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-8">
          <section>
            <SectionTitle>{t('orderType')}</SectionTitle>
            <OrderTypeTabs />
          </section>

          {isDelivery && (
            <section>
              <SectionTitle>{t('deliveryAddress')}</SectionTitle>
              <p className="mb-3 flex items-center gap-2 text-sm text-text-secondary">
                <Truck className="h-4 w-4 shrink-0 text-primary" />
                {t('deliveryBy')}
              </p>
              <textarea
                rows={3}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder={t('deliveryAddressPlaceholder')}
                className="w-full rounded-md border border-neutral-warm bg-card px-4 py-2 outline-none focus:border-primary"
              />
              {error && !deliveryAddress.trim() && (
                <p className="mt-2 text-sm text-error">{t('enterAddress')}</p>
              )}
            </section>
          )}

          <section>
            <SectionTitle>{t('branch')}</SectionTitle>
            <BranchPicker />
            {error && !branchId && <p className="mt-2 text-sm text-error">{t('selectBranch')}</p>}
          </section>

          <section>
            <SectionTitle>{t('payment')}</SectionTitle>
            <PaymentMethods />
          </section>

          {crossSell.length > 0 && (
            <section>
              <SectionTitle>{t('addExtra')}</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                {crossSell.map((item) => (
                  <MenuItemCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="h-fit space-y-5 rounded-lg border border-neutral-warm bg-card p-5 shadow-card lg:sticky lg:top-20">
          <SectionTitle>{t('summary')}</SectionTitle>
          <CartSummary totals={totals} />
          {isDelivery && (
            <div className="space-y-2 border-t border-neutral-warm pt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">{t('deliveryFee')}</span>
                <span className="font-bold tabular-nums">{formatJOD(DELIVERY_FEE, lang)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-md font-bold">{tc('total')}</span>
                <span className="text-lg font-bold tabular-nums">
                  {formatJOD(totals.total + DELIVERY_FEE, lang)}
                </span>
              </div>
              <p className="text-xs text-text-secondary">{t('deliveryEta', { min: DELIVERY_ETA })}</p>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-md bg-accent-light p-3 text-sm font-bold text-primary">
            <Sparkles className="h-4 w-4 shrink-0" />
            {t('earnBeans', { beans })}
          </div>
          <Button size="lg" className="w-full" onClick={place}>
            {t('placeOrder')}
          </Button>
          <div className="space-y-2 border-t border-neutral-warm pt-4">
              <p className="flex items-center gap-2 text-sm font-bold text-text-secondary">
                <Lock className="h-4 w-4 text-success" />
                {t('secure')}
              </p>
              <div className="flex items-center gap-3 text-text-secondary" aria-label={t('accepted')}>
                <Wallet className="h-5 w-5" />
                <Smartphone className="h-5 w-5" />
                <Banknote className="h-5 w-5" />
                <CreditCard className="h-5 w-5" />
              </div>
            </div>
        </aside>
      </div>
    </div>
  );
}
