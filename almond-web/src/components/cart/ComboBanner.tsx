'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Utensils } from 'lucide-react';
import { config } from '@almond/shared/config';
import { getComboUpsell } from '@almond/shared/lib/recommendations';
import { asLang } from '@/lib/format';
import { useCartStore } from '@/store/cartStore';

/**
 * Drink + food combo upsell — add the missing half to earn +50 points.
 * Same rule as the app (shared getComboUpsell / COMBO_BONUS_POINTS).
 */
export function ComboBanner() {
  const t = useTranslations('Cart');
  const lang = asLang(useLocale());
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);

  const upsell = getComboUpsell(items);
  if (!upsell || !upsell.item.sizes.length) return null;

  const { item, missing } = upsell;
  // earn-arith-exempt: upsell label only — no invoice, no grant. §3.5 / §7 T7.
  const points = config.COMBO_BONUS_POINTS;
  const name = lang === 'ar' ? item.nameAr : item.nameEn;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-dashed border-primary bg-accent-light px-4 py-3">
      <Utensils className="h-5 w-5 shrink-0 text-primary-dark" aria-hidden />
      <div className="min-w-0 flex-1">
        {/* Ink on the light-grey fill: 15:1. A line icon, not an emoji — the
            identity is black and white (owner, 2026-10-15). */}
        <p className="text-sm font-bold text-primary-dark">
          {missing === 'food' ? t('comboAddFood', { points }) : t('comboAddDrink', { points })}
        </p>
        <p className="truncate text-xs text-primary-dark">{name}</p>
      </div>
      <button
        type="button"
        onClick={() => addItem(item, item.sizes[0], [], 1)}
        className="shrink-0 rounded-pill bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/85"
      >
        {t('comboAdd')}
      </button>
    </div>
  );
}
