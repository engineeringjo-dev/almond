'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import type { Category, MenuItem } from '@almond/shared/types';
import { applyOverlay, getItemById } from '@/data/menu';
import { getFeaturedItems } from '@/data/featured';
import { useMenuOverlay } from '@/store/menuOverlayStore';
import { useRecentStore } from '@/store/recentStore';
import { asLang, formatNumber } from '@/lib/format';
import { config } from '@/lib/config';
import { MenuItemCard } from './MenuItemCard';
import { CategoryRail } from './CategoryRail';

type Section = { category: Category; items: MenuItem[] };

// Popular quick-search chips. The query is an English keyword (matches item
// nameEn in either locale so results are never empty); labels come from messages.
const POPULAR_QUERIES = ['latte', 'iced', 'cappuccino', 'croissant'];

export function MenuBrowser({ sections }: { sections: Section[] }) {
  const lang = asLang(useLocale());
  const t = useTranslations('Menu');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Apply admin menu edits (price / availability / name / hidden) live.
  const edits = useMenuOverlay((s) => s.edits);
  const merged = useMemo(
    () =>
      sections
        .map((s) => ({ category: s.category, items: applyOverlay(s.items, edits) }))
        .filter((s) => s.items.length > 0),
    [sections, edits],
  );

  // "Most loved" set → renders a Popular badge on those cards within the full menu.
  const popularIds = useMemo(() => new Set(getFeaturedItems(12).map((i) => i.id)), []);

  // Recently viewed (localStorage) → shown after mount to avoid a hydration gap,
  // filtered to items still visible in the menu.
  const recentIds = useRecentStore((s) => s.ids);
  const visibleIds = useMemo(
    () => new Set(merged.flatMap((s) => s.items.map((i) => i.id))),
    [merged],
  );
  const recentItems = useMemo(
    () =>
      recentIds
        .map((id) => getItemById(id))
        .filter((i): i is MenuItem => !!i && visibleIds.has(i.id))
        .slice(0, 6),
    [recentIds, visibleIds],
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

  const searchLabels = t.raw('searchTerms') as string[] | undefined;

  return (
    <div className="container-content py-xl">
      <h1 className="text-xxl">{t('title')}</h1>
      <p className="mt-1 text-md text-text-secondary">{t('subtitle')}</p>
      <p className="mt-1 text-xs text-text-secondary">
        {t('taxNote', { rate: formatNumber(Math.round(config.TAX_RATE * 100), lang) })}
      </p>

      {/* Search */}
      <div className="relative mt-5">
        <Search
          className="pointer-events-none absolute top-1/2 start-4 h-5 w-5 -translate-y-1/2 text-text-secondary"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-12 w-full rounded-pill border border-neutral-warm bg-card px-12 text-md outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('clearSearch')}
            className="absolute top-1/2 end-3 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-pill text-text-secondary hover:bg-neutral-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {/* Popular searches (only when the query is empty) */}
      {!q && Array.isArray(searchLabels) && searchLabels.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-text-secondary">{t('popularSearches')}</span>
          {searchLabels.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setQuery(POPULAR_QUERIES[i] ?? label)}
              className="rounded-pill bg-neutral-warm px-3 py-1 text-xs font-bold text-primary-dark transition-colors hover:bg-accent-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {results ? (
        <div className="mt-6">
          {results.length === 0 ? (
            <p className="py-12 text-center text-text-secondary">{t('noResults', { query })}</p>
          ) : (
            <>
              <p className="mb-4 text-sm text-text-secondary">
                {t('resultsCount', { count: formatNumber(results.length, lang) })}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((item) => (
                  <MenuItemCard key={item.id} item={item} popular={popularIds.has(item.id)} />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Recently viewed */}
          {mounted && recentItems.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg">{t('recentlyViewed')}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recentItems.map((item) => (
                  <MenuItemCard key={item.id} item={item} popular={popularIds.has(item.id)} />
                ))}
              </div>
            </section>
          )}

          <CategoryRail items={railItems} />
          <div className="mt-6 space-y-10">
            {merged.map((section) => (
              <section key={section.category.id} id={`cat-${section.category.id}`} className="scroll-mt-32">
                <h2 className="text-xl">
                  {lang === 'ar' ? section.category.nameAr : section.category.nameEn}
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {section.items.map((item) => (
                    <MenuItemCard key={item.id} item={item} popular={popularIds.has(item.id)} />
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
