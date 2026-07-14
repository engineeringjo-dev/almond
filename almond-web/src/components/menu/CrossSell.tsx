import { useTranslations } from 'next-intl';
import type { MenuItem } from '@almond/shared/types';
import { ProductCard } from '@/components/home/ProductCard';

/** "Goes well with" rail — reuses the shared cross-sell engine's suggestions. */
export function CrossSell({ items }: { items: MenuItem[] }) {
  const t = useTranslations('Menu');
  if (items.length === 0) return null;

  return (
    <section className="mt-xxl">
      <h2 className="text-xl">{t('goesWellWith')}</h2>
      <div className="no-scrollbar mt-4 flex gap-4 overflow-x-auto pb-2">
        {items.map((item) => (
          <ProductCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
