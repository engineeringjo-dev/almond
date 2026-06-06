'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LocateFixed, MapPin } from 'lucide-react';
import type { Branch } from '@almond/shared/types';
import { withDistances, type Coords } from '@/lib/distance';
import { asLang, formatNumber } from '@/lib/format';
import { BranchCard } from '@/components/home/BranchCard';

type GeoStatus = 'idle' | 'loading' | 'denied' | 'unavailable';

export function BranchesExplorer({ branches }: { branches: Branch[] }) {
  const t = useTranslations('Branches');
  const lang = asLang(useLocale());
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<GeoStatus>('idle');

  const locate = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable');
      return;
    }
    setStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus('idle');
      },
      () => setStatus('denied'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  };

  const list = useMemo(() => withDistances(branches, coords), [branches, coords]);
  const nearest = coords ? list[0] : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={locate}
          className="inline-flex h-10 items-center gap-2 rounded-pill border border-primary px-4 text-sm font-bold text-primary transition-colors hover:bg-accent-light"
        >
          <LocateFixed className="h-4 w-4" />
          {status === 'loading' ? t('locating') : t('findNearest')}
        </button>
        {status === 'denied' && <span className="text-sm text-error">{t('denied')}</span>}
        {status === 'unavailable' && <span className="text-sm text-error">{t('unavailable')}</span>}
      </div>

      {nearest && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-accent-light px-4 py-3 text-sm font-bold text-primary">
          <MapPin className="h-4 w-4 shrink-0" />
          {t('nearest')}: {lang === 'ar' ? nearest.branch.nameAr : nearest.branch.nameEn}
          {nearest.distanceKm != null && (
            <span className="text-text-secondary">
              · {t('away', { km: formatNumber(Number(nearest.distanceKm.toFixed(1)), lang) })}
            </span>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map(({ branch, distanceKm }) => (
          <BranchCard key={branch.id} branch={branch} distanceKm={distanceKm} />
        ))}
      </div>
    </div>
  );
}
