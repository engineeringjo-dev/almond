'use client';

import { useLocale } from 'next-intl';
import { Check, MapPin } from 'lucide-react';
import { getBranches } from '@/data/branches';
import { useCartStore } from '@/store/cartStore';
import { asLang } from '@/lib/format';
import { cn } from '@/lib/cn';

export function BranchPicker() {
  const lang = asLang(useLocale());
  const branchId = useCartStore((s) => s.branchId);
  const setBranch = useCartStore((s) => s.setBranch);
  const branches = getBranches();

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {branches.map((b) => {
        const selected = b.id === branchId;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => setBranch(b.id)}
            className={cn(
              'flex items-center justify-between rounded-lg border px-4 py-3 text-start transition-colors',
              selected ? 'border-primary bg-accent-light' : 'border-neutral-warm hover:border-primary',
            )}
          >
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <span className="font-bold">{lang === 'ar' ? b.nameAr : b.nameEn}</span>
            </span>
            {selected && <Check className="h-5 w-5 shrink-0 text-primary" />}
          </button>
        );
      })}
    </div>
  );
}
