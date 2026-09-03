'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { useOrderStore } from '@/store/orderStore';
import { comboPairs } from '@almond/shared/lib/combo';
import { earnedPoints } from '@almond/shared/loyalty/earn';
import { DISPLAY_EARN_RULES } from '@/data/order';
import { asLang, formatJOD } from '@/lib/format';
import { Button } from '@/components/ui/Button';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}

export function OrderSuccessView() {
  const t = useTranslations('OrderSuccess');
  const tc = useTranslations('Cart');
  const lang = asLang(useLocale());
  const order = useOrderStore((s) => s.lastOrder);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="container-content min-h-[50vh] py-xl" />;

  if (!order) {
    return (
      <section className="container-content flex min-h-[60vh] flex-col items-center justify-center gap-5 py-xxl text-center">
        <Button href="/menu" size="lg">
          {tc('browseMenu')}
        </Button>
      </section>
    );
  }

  const branch = lang === 'ar' ? order.branchNameAr : order.branchNameEn;
  const beans = earnedPoints(
    { total: order.total, comboPairs: comboPairs(order.items) },
    DISPLAY_EARN_RULES,
  );

  return (
    <section className="container-content flex flex-col items-center py-xxl text-center">
      <CheckCircle2 className="h-16 w-16 text-success" />
      <h1 className="mt-4 text-xxl">{t('title')}</h1>
      <p className="mt-1 text-md text-text-secondary">{t('subtitle')}</p>

      <div className="mt-6 w-full max-w-md rounded-lg border border-neutral-warm bg-card p-5 text-start shadow-card">
        <Row label={t('orderId')} value={`#${order.id.slice(-6).toUpperCase()}`} />
        {branch && <Row label={t('branch')} value={branch} />}
        <Row label={t('total')} value={formatJOD(order.total, lang)} />
        <div className="my-3 border-t border-neutral-warm" />
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-bold text-primary">
            <Sparkles className="h-4 w-4" />
            {t('beansEarned', { beans })}
          </span>
          <span className="rounded-pill bg-accent-light px-3 py-1 text-sm font-bold text-primary">
            {t('readyIn', { minutes: order.prepMinutes })}
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button href="/menu" variant="outline">
          {t('orderAgain')}
        </Button>
        <Button href="/rewards">{t('viewRewards')}</Button>
      </div>
    </section>
  );
}
