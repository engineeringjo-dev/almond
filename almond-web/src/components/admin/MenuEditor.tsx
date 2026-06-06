'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LogOut, RotateCcw, Search } from 'lucide-react';
import { useMenuOverlay } from '@/store/menuOverlayStore';
import { useAdminAuth } from '@/store/adminAuth';
import { fieldClass } from '@/components/forms/styles';
import { cn } from '@/lib/cn';

export type AdminItem = {
  id: string;
  nameAr: string;
  nameEn: string;
  basePrice: number;
  inStock: boolean;
};

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-10 rounded-pill transition-colors',
          checked ? 'bg-primary' : 'bg-neutral-warm',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-pill bg-white transition-all',
            checked ? 'start-[18px]' : 'start-0.5',
          )}
        />
      </button>
      {label}
    </label>
  );
}

function EditorRow({ item }: { item: AdminItem }) {
  const t = useTranslations('Admin');
  const patch = useMenuOverlay((s) => s.edits[item.id]);
  const setEdit = useMenuOverlay((s) => s.setEdit);
  const resetItem = useMenuOverlay((s) => s.resetItem);

  const [nameAr, setNameAr] = useState(patch?.nameAr ?? item.nameAr);
  const [nameEn, setNameEn] = useState(patch?.nameEn ?? item.nameEn);
  const [price, setPrice] = useState(String(patch?.price ?? item.basePrice));

  const inStock = patch?.inStock ?? item.inStock;
  const hidden = patch?.hidden ?? false;
  const dirty = !!patch && Object.keys(patch).length > 0;

  return (
    <div className={cn('rounded-lg border bg-card p-4', dirty ? 'border-primary' : 'border-neutral-warm')}>
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          className={fieldClass}
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
          onBlur={() => setEdit(item.id, { nameAr })}
          aria-label={t('nameAr')}
        />
        <input
          dir="ltr"
          className={fieldClass}
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          onBlur={() => setEdit(item.id, { nameEn })}
          aria-label={t('nameEn')}
        />
        <input
          type="number"
          step="0.1"
          min="0"
          dir="ltr"
          className={fieldClass}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => setEdit(item.id, { price: Number(price) })}
          aria-label={t('price')}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-5">
        <Toggle checked={inStock} onChange={(v) => setEdit(item.id, { inStock: v })} label={t('available')} />
        <Toggle checked={hidden} onChange={(v) => setEdit(item.id, { hidden: v })} label={t('hidden')} />
        <button
          type="button"
          onClick={() => {
            resetItem(item.id);
            setNameAr(item.nameAr);
            setNameEn(item.nameEn);
            setPrice(String(item.basePrice));
          }}
          className="ms-auto inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary"
        >
          <RotateCcw className="h-4 w-4" />
          {t('reset')}
        </button>
      </div>
    </div>
  );
}

export function MenuEditor({ items }: { items: AdminItem[] }) {
  const t = useTranslations('Admin');
  const edits = useMenuOverlay((s) => s.edits);
  const resetAll = useMenuOverlay((s) => s.resetAll);
  const logout = useAdminAuth((s) => s.logout);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const results = useMemo(
    () =>
      q
        ? items.filter((i) => i.nameAr.toLowerCase().includes(q) || i.nameEn.toLowerCase().includes(q))
        : items.slice(0, 20),
    [q, items],
  );
  const editedCount = Object.keys(edits).length;

  return (
    <div className="container-content py-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xxl">{t('title')}</h1>
        <div className="flex items-center gap-3">
          {editedCount > 0 && (
            <span className="rounded-pill bg-accent-light px-3 py-1 text-sm font-bold text-primary">
              {t('edited', { n: editedCount })}
            </span>
          )}
          {editedCount > 0 && (
            <button type="button" onClick={resetAll} className="text-sm font-bold text-text-secondary hover:text-error">
              {t('resetAll')}
            </button>
          )}
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1 text-sm font-bold text-text-secondary hover:text-primary"
          >
            <LogOut className="h-4 w-4" />
            {t('logout')}
          </button>
        </div>
      </div>

      <p className="mt-2 text-sm text-text-secondary">{t('syncNote')}</p>

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute top-1/2 start-4 h-5 w-5 -translate-y-1/2 text-text-secondary" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchItems')}
          className="h-12 w-full rounded-pill border border-neutral-warm bg-card px-12 text-md outline-none focus:border-primary"
        />
      </div>

      {!q && <p className="mt-4 text-sm text-text-secondary">{t('showingFirst', { n: results.length })}</p>}

      <div className="mt-4 space-y-3">
        {results.map((item) => (
          <EditorRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
