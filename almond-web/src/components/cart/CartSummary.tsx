'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { CartTotals } from '@almond/shared/cart';
import { asLang, formatJOD } from '@/lib/format';
import { cn } from '@/lib/cn';

function Row({
  label,
  value,
  strong,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn(strong ? 'text-md font-bold' : 'text-sm text-text-secondary')}>
        {label}
      </span>
      <span
        className={cn(
          'tabular-nums',
          strong ? 'text-lg font-bold' : 'text-sm font-bold',
          accent && 'text-primary',
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function CartSummary({ totals }: { totals: CartTotals }) {
  const lang = asLang(useLocale());
  const t = useTranslations('Cart');

  return (
    <div className="space-y-3">
      <Row label={t('subtotal')} value={formatJOD(totals.subtotal, lang)} />
      {totals.discount > 0 && (
        <Row label={t('discount')} value={`− ${formatJOD(totals.discount, lang)}`} accent />
      )}
      <Row label={t('tax')} value={formatJOD(totals.tax, lang)} />
      <div className="border-t border-neutral-warm pt-3">
        <Row label={t('total')} value={formatJOD(totals.total, lang)} strong />
      </div>
    </div>
  );
}
