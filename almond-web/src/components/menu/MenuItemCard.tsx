'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Plus } from 'lucide-react';
import type { MenuItem } from '@almond/shared/types';
import { Link } from '@/i18n/navigation';
import { useCartStore } from '@/store/cartStore';
import { itemFromPrice } from '@/data/menu';
import { asLang, formatJOD } from '@/lib/format';
import { cn } from '@/lib/cn';

export function MenuItemCard({ item }: { item: MenuItem }) {
  const lang = asLang(useLocale());
  const t = useTranslations('Menu');
  const addItem = useCartStore((s) => s.addItem);
  const [added, setAdded] = useState(false);

  const name = lang === 'ar' ? item.nameAr : item.nameEn;
  const desc = lang === 'ar' ? item.descAr : item.descEn;
  const price = itemFromPrice(item);
  const soldOut = item.inStock === false;

  const quickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!item.sizes.length) return;
    // Cheapest size, no customizations — the default "quick add".
    const size = item.sizes.reduce((a, b) => (b.price < a.price ? b : a), item.sizes[0]);
    addItem(item, size, [], 1);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  };

  return (
    <Link
      href={`/menu/${item.id}`}
      className="group relative flex gap-4 rounded-lg border border-neutral-warm bg-card p-3 shadow-card transition-transform duration-base hover:-translate-y-0.5"
    >
      <div className="product-thumb h-24 w-24 shrink-0">
        {item.imageUrl && (
          <Image src={item.imageUrl} alt={name} fill sizes="96px" className="object-contain p-1.5" />
        )}
      </div>
      <div className="min-w-0 flex-1 pe-10">
        <h3 className="line-clamp-1 font-bold">{name}</h3>
        {desc && <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{desc}</p>}
        <p className="mt-2 text-sm font-bold text-primary">
          {t('from')} {formatJOD(price, lang)}
        </p>
      </div>

      {soldOut ? (
        <span className="absolute end-3 top-3 rounded-pill bg-neutral-warm px-2 py-0.5 text-xs text-text-secondary">
          {t('soldOut')}
        </span>
      ) : (
        <button
          type="button"
          onClick={quickAdd}
          aria-label={t('addToCart')}
          className={cn(
            'absolute bottom-3 end-3 inline-flex h-9 w-9 items-center justify-center rounded-pill text-white shadow-card transition-colors',
            added ? 'bg-success' : 'bg-primary hover:bg-primary-dark',
          )}
        >
          {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
      )}
    </Link>
  );
}
