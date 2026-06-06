'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { computeTotals } from '@almond/shared/cart';
import { getBranches } from '@/data/branches';
import { createMockOrder, estimatedBeans } from '@/data/order';
import { useCartStore } from '@/store/cartStore';
import { useOrderStore } from '@/store/orderStore';
import { useRouter } from '@/i18n/navigation';
import { config } from '@/lib/config';
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
  const clear = useCartStore((s) => s.clear);
  const setLastOrder = useOrderStore((s) => s.setLastOrder);

  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => setMounted(true), []);

  const totals = useMemo(() => computeTotals(items, promoDiscount), [items, promoDiscount]);
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
    if (!isDelivery && !branchId) {
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
    });
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

          {isDelivery ? (
            <div className="rounded-lg border border-neutral-warm bg-neutral-warm/40 p-5">
              <p className="text-md text-text-secondary">{t('deliveryNote')}</p>
              <a
                href={config.DELIVERY_REDIRECT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex h-11 items-center justify-center rounded-pill bg-primary px-6 font-bold text-white hover:bg-primary-dark"
              >
                {t('deliveryCta')}
              </a>
            </div>
          ) : (
            <>
              <section>
                <SectionTitle>{t('branch')}</SectionTitle>
                <BranchPicker />
                {error && <p className="mt-2 text-sm text-error">{t('selectBranch')}</p>}
              </section>
              <section>
                <SectionTitle>{t('payment')}</SectionTitle>
                <PaymentMethods />
              </section>
            </>
          )}
        </div>

        <aside className="h-fit space-y-5 rounded-lg border border-neutral-warm bg-card p-5 shadow-card lg:sticky lg:top-20">
          <SectionTitle>{t('summary')}</SectionTitle>
          <CartSummary totals={totals} />
          <div className="flex items-center gap-2 rounded-md bg-accent-light p-3 text-sm font-bold text-primary">
            <Sparkles className="h-4 w-4 shrink-0" />
            {t('earnBeans', { beans })}
          </div>
          {!isDelivery && (
            <Button size="lg" className="w-full" onClick={place}>
              {t('placeOrder')}
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}
