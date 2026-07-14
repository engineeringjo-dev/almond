'use client';

import { useLocale, useTranslations } from 'next-intl';
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
  const points = config.COMBO_BONUS_POINTS;
  const name = lang === 'ar' ? item.nameAr : item.nameEn;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-dashed border-primary bg-accent-light px-4 py-3">
      <span className="text-xl" aria-hidden>
        🍽️
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-primary">
          {missing === 'food' ? t('comboAddFood', { points }) : t('comboAddDrink', { points })}
        </p>
        <p className="truncate text-xs text-text-secondary">{name}</p>
      </div>
      <button
        type="button"
        onClick={() => addItem(item, item.sizes[0], [], 1)}
        className="shrink-0 rounded-pill bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-dark"
      >
        {t('comboAdd')}
      </button>
    </div>
  );
}
