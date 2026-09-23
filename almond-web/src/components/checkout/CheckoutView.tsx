'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Banknote, CreditCard, Lock, Smartphone, Sparkles, Truck, Wallet } from 'lucide-react';
import { computeTotals } from '@almond/shared/cart';
import { getCartCrossSell } from '@almond/shared/lib/recommendations';
import { comboPairs } from '@almond/shared/lib/combo';
import { earnedPoints } from '@almond/shared/loyalty/earn';
import { getBranches } from '@/data/branches';
import { MenuItemCard } from '@/components/menu/MenuItemCard';
import { createMockOrder, DISPLAY_EARN_RULES } from '@/data/order';
import { useCartStore } from '@/store/cartStore';
import { useLoyaltyStore } from '@/store/loyaltyStore';
import { useOrderStore } from '@/store/orderStore';
import { useRouter } from '@/i18n/navigation';
import { DELIVERY_ETA, DELIVERY_FEE, dispatchDelivery } from '@/data/delivery';
import { payForOrder } from '@/data/payment';
import { settleOrder } from '@/data/checkout';
import { asLang, formatJOD } from '@/lib/format';
import { OrderTypeTabs } from './OrderTypeTabs';
import { BranchPicker } from './BranchPicker';
import { PaymentMethods } from './PaymentMethods';
import { CartSummary } from '@/components/cart/CartSummary';
import { Button } from '@/components/ui/Button';

function SectionTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mb-3 text-lg">
      {children}
    </h2>
  );
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

  const windowSpend = useLoyaltyStore((s) => s.windowSpend);

  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [payFailed, setPayFailed] = useState(false);
  useEffect(() => setMounted(true), []);

  const totals = useMemo(() => computeTotals(items, promoDiscount), [items, promoDiscount]);
  const crossSell = useMemo(() => getCartCrossSell(items, 2), [items]);
  // The member's 90-day window is passed in, so the quoted figure follows the
  // rung the rewards page names on the same site. Without it earn.ts resolves
  // `rungFromSpend(0)` and the checkout always quotes the ENTRY rate — it
  // under-states, which is the safe direction, but it means a 4% member is
  // shown 8 points on a basket that pays 16.
  const beans = earnedPoints(
    { total: totals.total, windowSpend, comboPairs: comboPairs(items) },
    DISPLAY_EARN_RULES,
  );
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

  const place = async () => {
    if (placing) return; // a second tap must not place (or charge) twice
    if (!branchId || (isDelivery && !deliveryAddress.trim())) {
      setError(true);
      return;
    }
    setPayFailed(false);
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
    // Pay first and wait for the answer; dispatch and place only after it
    // (src/data/checkout.ts). A failed payment leaves the cart intact.
    setPlacing(true);
    const result = await settleOrder(order, {
      pay: paymentMethod !== 'cash' ? payForOrder : undefined, // secure payment seam
      dispatch: isDelivery ? dispatchDelivery : undefined, // Ishbek seam, our server route
      onDispatchError: (err) => console.error('delivery dispatch failed', err),
      place: (o) => {
        setLastOrder(o);
        clear();
        router.push('/checkout/success');
      },
    });
    if (!result.ok) {
      console.error('payment failed', result.error);
      setPayFailed(true);
      setPlacing(false);
    }
  };

  return (
    <div className="container-content py-xl">
      <h1 className="text-xxl">{t('title')}</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-8">
          <section>
            <SectionTitle id="co-order-type">{t('orderType')}</SectionTitle>
            <OrderTypeTabs labelledBy="co-order-type" />
          </section>

          {isDelivery && (
            <section>
              <SectionTitle id="co-address">{t('deliveryAddress')}</SectionTitle>
              <p className="mb-3 flex items-center gap-2 text-sm text-text-secondary">
                <Truck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                {t('deliveryBy')}
              </p>
              <textarea
                rows={3}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder={t('deliveryAddressPlaceholder')}
                aria-labelledby="co-address"
                aria-required
                aria-invalid={(error && !deliveryAddress.trim()) || undefined}
                className="w-full rounded-md border border-neutral-warm bg-card px-4 py-2 outline-none focus:border-primary"
              />
              {error && !deliveryAddress.trim() && (
                <p role="alert" className="mt-2 text-sm text-error">
                  {t('enterAddress')}
                </p>
              )}
            </section>
          )}

          <section>
            <SectionTitle id="co-branch">{t('branch')}</SectionTitle>
            <BranchPicker labelledBy="co-branch" />
            {error && !branchId && (
              <p role="alert" className="mt-2 text-sm text-error">
                {t('selectBranch')}
              </p>
            )}
          </section>

          <section>
            <SectionTitle id="co-payment">{t('payment')}</SectionTitle>
            <PaymentMethods labelledBy="co-payment" />
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
          <div className="flex items-center gap-2 rounded-md bg-accent-light p-3 text-sm font-bold text-primary-dark">
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
            {t('earnBeans', { beans })}
          </div>
          {payFailed && (
            <p role="alert" className="text-sm font-bold text-error">
              {t('paymentFailed')}
            </p>
          )}
          <Button
            size="lg"
            className="w-full"
            onClick={place}
            disabled={placing}
            aria-busy={placing || undefined}
          >
            {placing ? t('placing') : t('placeOrder')}
          </Button>
          <div className="space-y-2 border-t border-neutral-warm pt-4">
              <p className="flex items-center gap-2 text-sm font-bold text-text-secondary">
                <Lock className="h-4 w-4 text-success" aria-hidden />
                {t('secure')}
              </p>
              {/* aria-label on a plain <div> is ignored by assistive tech (and is
                  a prohibited attribute there); role="img" makes the row one
                  labelled graphic. */}
              <div
                role="img"
                className="flex items-center gap-3 text-text-secondary"
                aria-label={t('accepted')}
              >
                <Wallet className="h-5 w-5" aria-hidden />
                <Smartphone className="h-5 w-5" aria-hidden />
                <Banknote className="h-5 w-5" aria-hidden />
                <CreditCard className="h-5 w-5" aria-hidden />
              </div>
            </div>
        </aside>
      </div>
    </div>
  );
}
