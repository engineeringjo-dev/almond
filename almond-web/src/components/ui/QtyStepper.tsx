'use client';

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
  const btn =
    'inline-flex h-9 w-9 items-center justify-center rounded-pill text-primary transition-colors hover:bg-accent-light disabled:opacity-40';
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-pill border border-neutral-warm bg-card p-1',
        className,
      )}
    >
      <button type="button" onClick={onDec} disabled={value <= min} aria-label="−" className={btn}>
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-7 text-center font-bold tabular-nums">{value}</span>
      <button type="button" onClick={onInc} aria-label="+" className={btn}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
