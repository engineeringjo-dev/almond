'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Cup } from '@/components/ui/Cup';
import { Button } from '@/components/ui/Button';
import { useLoyaltyStore } from '@/store/loyaltyStore';
import { asLang, formatNumber } from '@/lib/format';
import { config } from '@/lib/config';

export function LoyaltySection() {
  const t = useTranslations('Home.loyalty');
  const lang = asLang(useLocale());
  const cup = useLoyaltyStore((s) => s.cup);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Before mount, render the store's seed (6 / CUP_TARGET) so SSR and the first
  // client paint match; after mount, reflect the member's real cup progress.
  const current = mounted ? cup.current : 6;
  const target = mounted ? cup.target : config.CUP_TARGET;

  return (
    <section className="container-content py-xl">
      <div className="overflow-hidden rounded-xl bg-gradient-purple text-white">
        <div className="grid items-center gap-8 p-8 md:grid-cols-[1fr_auto] md:p-12">
          <div className="max-w-xl">
            <h2 className="text-xxl text-white">{t('title')}</h2>
            <p className="mt-3 text-md text-white/85">{t('text')}</p>
            <div className="mt-6">
              <Button href="/rewards" variant="onDark" size="lg">
                {t('cta')}
              </Button>
            </div>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="w-36 text-white">
              <Cup current={current} target={target} decorative />
            </div>
            <span className="rounded-pill bg-white/15 px-4 py-1.5 text-sm font-bold">
              {t('cupLabel', { current: formatNumber(current, lang), target: formatNumber(target, lang) })}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
