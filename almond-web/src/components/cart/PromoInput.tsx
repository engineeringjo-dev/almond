'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Tag, X } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { resolvePromo } from '@/lib/promo';

export function PromoInput() {
  const t = useTranslations('Cart');
  const promoCode = useCartStore((s) => s.promoCode);
  const setPromo = useCartStore((s) => s.setPromo);
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  const apply = () => {
    const discount = resolvePromo(code);
    if (discount > 0) {
      setPromo(code.trim().toUpperCase(), discount);
      setError(false);
      setCode('');
    } else {
      setError(true);
    }
  };

  if (promoCode) {
    return (
      <div className="flex items-center justify-between rounded-md border border-primary bg-accent-light px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-bold text-primary">
          <Check className="h-4 w-4" />
          {t('promoApplied', { code: promoCode })}
        </span>
        <button
          type="button"
          onClick={() => setPromo(null, 0)}
          aria-label={t('removePromo')}
          className="text-text-secondary hover:text-error"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && apply()}
            placeholder={t('promoPlaceholder')}
            className="h-11 w-full rounded-pill border border-neutral-warm bg-card ps-9 pe-4 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          type="button"
          onClick={apply}
          className="h-11 shrink-0 rounded-pill border border-primary px-5 text-sm font-bold text-primary hover:bg-accent-light"
        >
          {t('apply')}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-error">{t('promoInvalid')}</p>}
    </div>
  );
}
