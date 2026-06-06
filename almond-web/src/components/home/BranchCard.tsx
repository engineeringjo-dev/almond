'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Clock, MapPin } from 'lucide-react';
import type { Branch } from '@almond/shared/types';
import { isBranchOpen } from '@/data/branches';
import { asLang, formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';

export function BranchCard({ branch, distanceKm }: { branch: Branch; distanceKm?: number }) {
  const t = useTranslations('Branches');
  const lang = asLang(useLocale());

  // Compute open/closed after mount to avoid an SSR/client time mismatch.
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => setOpen(isBranchOpen(branch)), [branch]);

  const name = lang === 'ar' ? branch.nameAr : branch.nameEn;
  const area = lang === 'ar' ? branch.areaAr : branch.areaEn;
  const maps = `https://www.google.com/maps/search/?api=1&query=${branch.lat},${branch.lng}`;

  return (
    <div className="rounded-lg border border-neutral-warm bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{name}</h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-text-secondary">
            <MapPin className="h-4 w-4 shrink-0" />
            {area}
            {distanceKm != null && (
              <span className="font-bold text-primary">
                · {t('away', { km: formatNumber(Number(distanceKm.toFixed(1)), lang) })}
              </span>
            )}
          </p>
        </div>
        {open !== null && (
          <span
            className={cn(
              'shrink-0 rounded-pill px-3 py-1 text-xs font-bold',
              open ? 'bg-accent-light text-primary' : 'bg-neutral-warm text-text-secondary',
            )}
          >
            {open ? t('openNow') : t('closed')}
          </span>
        )}
      </div>
      <p className="mt-3 flex items-center gap-1 text-sm text-text-secondary">
        <Clock className="h-4 w-4 shrink-0" />
        <span dir="ltr">
          {branch.hours.open}–{branch.hours.close}
        </span>
      </p>
      <a
        href={maps}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex text-sm font-bold text-primary hover:underline"
      >
        {t('directions')}
      </a>
    </div>
  );
}
