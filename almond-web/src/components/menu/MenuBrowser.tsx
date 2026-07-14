'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import type { Category, MenuItem } from '@almond/shared/types';
import { applyOverlay } from '@/data/menu';
import { useMenuOverlay } from '@/store/menuOverlayStore';
import { asLang } from '@/lib/format';
import { MenuItemCard } from './MenuItemCard';
import { CategoryRail } from './CategoryRail';

type Section = { category: Category; items: MenuItem[] };

export function MenuBrowser({ sections }: { sections: Section[] }) {
  const lang = asLang(useLocale());
  const t = useTranslations('Menu');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  // Apply admin menu edits (price / availability / name / hidden) live.
  const edits = useMenuOverlay((s) => s.edits);
  const merged = useMemo(
    () =>
      sections
        .map((s) => ({ category: s.category, items: applyOverlay(s.items, edits) }))
        .filter((s) => s.items.length > 0),
    [sections, edits],
  );

  const results = useMemo(() => {
    if (!q) return null;
    return merged
      .flatMap((s) => s.items)
      .filter((i) =>
        [i.nameAr, i.nameEn, i.descAr, i.descEn].some((f) => f?.toLowerCase().includes(q)),
      );
  }, [q, merged]);

  const railItems = merged.map((s) => ({
    id: s.category.id,
    name: lang === 'ar' ? s.category.nameAr : s.category.nameEn,
  }));

  return (
    <div className="container-content py-xl">
      <h1 className="text-xxl">{t('title')}</h1>
      <p className="mt-1 text-md text-text-secondary">{t('subtitle')}</p>

      {/* Search */}
      <div className="relative mt-5">
        <Search className="pointer-events-none absolute top-1/2 start-4 h-5 w-5 -translate-y-1/2 text-text-secondary" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-12 w-full rounded-pill border border-neutral-warm bg-card px-12 text-md outline-none transition-colors focus:border-primary"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('clearSearch')}
            className="absolute top-1/2 end-3 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-pill text-text-secondary hover:bg-neutral-warm"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {results ? (
        <div className="mt-6">
          {results.length === 0 ? (
            <p className="py-12 text-center text-text-secondary">
              {t('noResults', { query })}
            </p>
          ) : (
            <>
              <p className="mb-4 text-sm text-text-secondary">
                {t('resultsCount', { count: results.length })}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((item) => (
                  <MenuItemCard key={item.id} item={item} />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <CategoryRail items={railItems} />
          <div className="mt-6 space-y-10">
            {merged.map((section) => (
              <section key={section.category.id} id={`cat-${section.category.id}`} className="scroll-mt-32">
                <h2 className="text-xl">
                  {lang === 'ar' ? section.category.nameAr : section.category.nameEn}
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {section.items.map((item) => (
                    <MenuItemCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
