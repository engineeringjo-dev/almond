'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronLeft } from 'lucide-react';
import type { CartCustomization, ItemSize, MenuItem } from '@almond/shared/types';
import { getSizeUpsell } from '@almond/shared/lib/recommendations';
import { Link } from '@/i18n/navigation';
import { useCartStore } from '@/store/cartStore';
import { QtyStepper } from '@/components/ui/QtyStepper';
import { asLang, formatJOD } from '@/lib/format';
import { cn } from '@/lib/cn';

export function ItemConfigurator({ item }: { item: MenuItem }) {
  const lang = asLang(useLocale());
  const t = useTranslations('Menu');
  const nav = useTranslations('Nav');
  const addItem = useCartStore((s) => s.addItem);
  const tr = (ar?: string, en?: string) => (lang === 'ar' ? ar : en) ?? '';

  const [sizeId, setSizeId] = useState<ItemSize['id']>(item.sizes[0]?.id ?? 'M');
  const [selection, setSelection] = useState<Record<string, string[]>>(() => {
    // Single-choice groups default to their first option (deterministic price).
    const init: Record<string, string[]> = {};
    for (const g of item.customizations) {
      if (!g.multiple && g.options[0]) init[g.id] = [g.options[0].id];
    }
    return init;
  });
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const size = item.sizes.find((s) => s.id === sizeId) ?? item.sizes[0];
  const chosen: CartCustomization[] = useMemo(() => {
    const out: CartCustomization[] = [];
    for (const g of item.customizations) {
      for (const oid of selection[g.id] ?? []) {
        const opt = g.options.find((o) => o.id === oid);
        if (opt) {
          out.push({
            groupId: g.id,
            optionId: opt.id,
            nameAr: opt.nameAr,
            nameEn: opt.nameEn,
            priceDelta: opt.priceDelta,
          });
        }
      }
    }
    return out;
  }, [selection, item.customizations]);

  const unit = (size?.price ?? 0) + chosen.reduce((s, c) => s + c.priceDelta, 0);
  const total = unit * qty;
  const soldOut = item.inStock === false;
  const upsell = getSizeUpsell(item, sizeId); // "go large for +X" (null if already largest)

  const toggle = (groupId: string, optionId: string, multiple: boolean) =>
    setSelection((prev) => {
      const cur = prev[groupId] ?? [];
      if (multiple) {
        return {
          ...prev,
          [groupId]: cur.includes(optionId)
            ? cur.filter((x) => x !== optionId)
            : [...cur, optionId],
        };
      }
      return { ...prev, [groupId]: [optionId] };
    });

  const add = () => {
    if (soldOut || !size) return;
    addItem(item, size, chosen, qty);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  const name = tr(item.nameAr, item.nameEn);
  const desc = tr(item.descAr, item.descEn);

  return (
    <div>
      <Link
        href="/menu"
        className="inline-flex items-center gap-1 text-sm font-bold text-text-secondary hover:text-primary"
      >
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        {t('back')}
      </Link>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        {/* Image */}
        <div className="product-thumb mx-auto w-full max-w-md shadow-card">
          {item.imageUrl && (
            <Image
              src={item.imageUrl}
              alt={name}
              fill
              sizes="(max-width: 768px) 100vw, 448px"
              className="object-contain p-6"
              priority
            />
          )}
        </div>

        {/* Configurator */}
        <div>
          <h1 className="text-xxl">{name}</h1>
          {desc && <p className="mt-2 text-md text-text-secondary">{desc}</p>}

          {/* Sizes */}
          {item.sizes.length > 1 && (
            <div className="mt-6">
              <h2 className="text-sm font-bold uppercase tracking-wide text-text-secondary">
                {t('size')}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.sizes.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSizeId(s.id)}
                    className={cn(
                      'rounded-pill border px-4 py-2 text-sm font-bold transition-colors',
                      s.id === sizeId
                        ? 'border-primary bg-primary text-white'
                        : 'border-neutral-warm hover:border-primary',
                    )}
                  >
                    {tr(s.nameAr, s.nameEn)} · {formatJOD(s.price, lang)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size upsell nudge */}
          {upsell && (
            <button
              type="button"
              onClick={() => setSizeId(upsell.size.id)}
              className="mt-4 flex w-full items-center justify-between rounded-md border border-dashed border-primary bg-accent-light px-4 py-3 text-start"
            >
              <span className="text-sm font-bold text-primary">
                {t('upsize', {
                  size: tr(upsell.size.nameAr, upsell.size.nameEn),
                  price: formatJOD(upsell.delta, lang),
                })}
              </span>
              <ChevronLeft className="h-4 w-4 shrink-0 text-primary rtl:rotate-180" />
            </button>
          )}

          {/* Customization groups */}
          {item.customizations.map((g) => (
            <div key={g.id} className="mt-6">
              <h2 className="text-sm font-bold uppercase tracking-wide text-text-secondary">
                {tr(g.nameAr, g.nameEn)}
              </h2>
              <div className="mt-3 space-y-2">
                {g.options.map((o) => {
                  const selected = (selection[g.id] ?? []).includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggle(g.id, o.id, g.multiple)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-md border px-4 py-3 text-start transition-colors',
                        selected
                          ? 'border-primary bg-accent-light'
                          : 'border-neutral-warm hover:border-primary',
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center border',
                            g.multiple ? 'rounded-md' : 'rounded-pill',
                            selected ? 'border-primary bg-primary text-white' : 'border-neutral-warm',
                          )}
                        >
                          {selected && <Check className="h-3 w-3" />}
                        </span>
                        <span className="font-bold">{tr(o.nameAr, o.nameEn)}</span>
                      </span>
                      {o.priceDelta > 0 && (
                        <span className="text-sm text-text-secondary">
                          +{formatJOD(o.priceDelta, lang)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quantity + add */}
          <div className="sticky bottom-0 -mx-5 mt-8 border-t border-neutral-warm bg-background/95 px-5 py-4 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0">
            <div className="flex items-center gap-3">
              <QtyStepper
                value={qty}
                onInc={() => setQty((q) => q + 1)}
                onDec={() => setQty((q) => Math.max(1, q - 1))}
              />
              <button
                type="button"
                onClick={add}
                disabled={soldOut}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-pill bg-primary px-6 font-bold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
              >
                {soldOut ? (
                  t('soldOut')
                ) : added ? (
                  <>
                    <Check className="h-5 w-5" /> {t('added')}
                  </>
                ) : (
                  <>
                    {t('addToCart')} · {formatJOD(total, lang)}
                  </>
                )}
              </button>
            </div>
            {added && (
              <Link
                href="/cart"
                className="mt-3 block text-center text-sm font-bold text-primary"
              >
                {nav('cart')} →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
