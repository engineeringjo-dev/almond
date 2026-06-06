import { useTranslations } from 'next-intl';
import { getFeaturedItems } from '@/data/featured';
import { Link } from '@/i18n/navigation';
import { ProductCard } from './ProductCard';

export function FeaturedRow() {
  const t = useTranslations('Home.featured');
  const items = getFeaturedItems(12);

  return (
    <section className="container-content py-xxl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xxl">{t('title')}</h2>
          <p className="mt-1 text-md text-text-secondary">{t('subtitle')}</p>
        </div>
        <Link
          href="/menu"
          className="shrink-0 text-sm font-bold text-primary hover:underline"
        >
          {t('viewAll')}
        </Link>
      </div>

      <div className="no-scrollbar -mx-5 mt-6 flex gap-4 overflow-x-auto px-5 pb-2 md:-mx-8 md:px-8">
        {items.map((item) => (
          <ProductCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
