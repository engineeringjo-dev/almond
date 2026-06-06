'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import type { CartItem } from '@almond/shared/types';
import { lineUnitPrice } from '@almond/shared/cart';
import { getItemById } from '@/data/menu';
import { useCartStore } from '@/store/cartStore';
import { QtyStepper } from '@/components/ui/QtyStepper';
import { asLang, formatJOD } from '@/lib/format';

export function CartLine({ line }: { line: CartItem }) {
  const lang = asLang(useLocale());
  const t = useTranslations('Cart');
  const incLine = useCartStore((s) => s.incLine);
  const decLine = useCartStore((s) => s.decLine);
  const removeLine = useCartStore((s) => s.removeLine);
  const tr = (ar?: string, en?: string) => (lang === 'ar' ? ar : en) ?? '';

  const img = getItemById(line.itemId)?.imageUrl;
  const name = tr(line.nameAr, line.nameEn);
  const sizeName = tr(line.sizeNameAr, line.sizeNameEn);
  const custs = line.customizations
    .map((c) => tr(c.nameAr, c.nameEn))
    .join(lang === 'ar' ? '، ' : ', ');
  const lineTotal = lineUnitPrice(line) * line.qty;

  return (
    <div className="flex gap-4 py-4">
      <div className="product-thumb h-20 w-20 shrink-0 border border-neutral-warm">
        {img && <Image src={img} alt={name} fill sizes="80px" className="object-contain p-1.5" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold">{name}</h3>
          <span className="shrink-0 font-bold text-primary">{formatJOD(lineTotal, lang)}</span>
        </div>
        <p className="mt-0.5 text-sm text-text-secondary">
          {t('size')}: {sizeName}
        </p>
        {custs && <p className="mt-0.5 line-clamp-1 text-sm text-text-secondary">{custs}</p>}

        <div className="mt-3 flex items-center justify-between">
          <QtyStepper
            value={line.qty}
            onInc={() => incLine(line.lineId)}
            onDec={() => decLine(line.lineId)}
          />
          <button
            type="button"
            onClick={() => removeLine(line.lineId)}
            aria-label={t('remove')}
            className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-error"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('remove')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
