'use client';

import { useTranslations } from 'next-intl';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

type Props = {
  value: number;
  onInc: () => void;
  onDec: () => void;
  min?: number;
  className?: string;
};

export function QtyStepper({ value, onInc, onDec, min = 1, className }: Props) {
  const t = useTranslations('Common');
  const btn =
    'inline-flex h-9 w-9 items-center justify-center rounded-pill text-primary transition-colors hover:bg-accent-light disabled:opacity-40';
  return (
    <div
      role="group"
      aria-label={t('quantity')}
      className={cn(
        'inline-flex items-center gap-1 rounded-pill border border-neutral-warm bg-card p-1',
        className,
      )}
    >
      {/* The labels were the glyphs "−" / "+", which a screen reader reads as
          "minus" / "plus" with no idea of what they change. */}
      <button type="button" onClick={onDec} disabled={value <= min} aria-label={t('decreaseQty')} className={btn}>
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <span className="min-w-7 text-center font-bold tabular-nums" aria-live="polite">{value}</span>
      <button type="button" onClick={onInc} aria-label={t('increaseQty')} className={btn}>
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
