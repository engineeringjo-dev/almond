import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import type { MenuItem } from '@almond/shared/types';
import { Link } from '@/i18n/navigation';
import { itemFromPrice } from '@/data/menu';
import { asLang, formatJOD } from '@/lib/format';

export function ProductCard({ item }: { item: MenuItem }) {
  const locale = useLocale();
  const lang = asLang(locale);
  const t = useTranslations('Product');

  const name = lang === 'ar' ? item.nameAr : item.nameEn;
  const price = itemFromPrice(item);

  return (
    <Link
      href={`/menu/${item.id}`}
      className="group flex w-44 shrink-0 flex-col gap-3 sm:w-52"
    >
      <div className="product-thumb shadow-card transition-transform duration-base group-hover:-translate-y-1">
        {item.imageUrl && (
          <Image
            src={item.imageUrl}
            alt={name}
            fill
            sizes="(max-width: 640px) 176px, 208px"
            className="object-contain p-3"
          />
        )}
      </div>
      <div>
        <h3 className="line-clamp-2 text-sm font-bold leading-snug">{name}</h3>
        <p className="mt-1 text-sm text-text-secondary">
          {t('from')}{' '}
          <span className="font-bold text-primary">{formatJOD(price, lang)}</span>
        </p>
      </div>
    </Link>
  );
}
