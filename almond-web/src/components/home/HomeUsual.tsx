'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { RotateCcw } from 'lucide-react';
import { useOrderStore } from '@/store/orderStore';
import { useCartStore } from '@/store/cartStore';
import { useRouter } from '@/i18n/navigation';
import { asLang, formatJOD, formatNumber } from '@/lib/format';

/** "Your usual" — one-tap reorder of the last placed order (Starbucks pattern). */
export function HomeUsual() {
  const t = useTranslations('Home.usual');
  const lang = asLang(useLocale());
  const lastOrder = useOrderStore((s) => s.lastOrder);
  const addLine = useCartStore((s) => s.addLine);
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !lastOrder || lastOrder.items.length === 0) return null;

  const names = lastOrder.items
    .map((l) => (lang === 'ar' ? l.nameAr : l.nameEn))
    .join(lang === 'ar' ? '، ' : ', ');

  const reorder = () => {
    lastOrder.items.forEach(addLine);
    router.push('/cart');
  };

  return (
    <section className="container-content">
      <div className="flex flex-col gap-4 rounded-xl border border-neutral-warm bg-card p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-text-secondary">{t('title')}</p>
          <p className="mt-1 line-clamp-1 text-lg font-bold">{names}</p>
          <p className="text-sm text-text-secondary">
            {t('items', { count: formatNumber(lastOrder.items.length, lang) })} · {formatJOD(lastOrder.total, lang)}
          </p>
        </div>
        <button
          type="button"
          onClick={reorder}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-pill bg-primary px-6 font-bold text-white transition-colors hover:bg-primary-dark"
        >
          <RotateCcw className="h-4 w-4" />
          {t('reorder')}
        </button>
      </div>
    </section>
  );
}
