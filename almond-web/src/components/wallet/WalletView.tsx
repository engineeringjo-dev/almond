'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Sparkles, Wallet } from 'lucide-react';
import { useLoyaltyStore } from '@/store/loyaltyStore';
import { TOPUP_AMOUNTS, reloadBonus } from '@/data/loyalty';
import { asLang, formatDate, formatJOD, formatNumber } from '@/lib/format';
import { PageSkeleton } from '@/components/ui/Skeleton';

export function WalletView() {
  const t = useTranslations('Wallet');
  const lang = asLang(useLocale());
  const balance = useLoyaltyStore((s) => s.walletBalance);
  const history = useLoyaltyStore((s) => s.walletHistory);
  const topUp = useLoyaltyStore((s) => s.topUp);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <PageSkeleton />;

  return (
    <div className="container-content py-xl">
      <h1 className="text-xxl">{t('title')}</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        {/* Balance */}
        <div className="h-fit rounded-xl bg-gradient-dark p-6 text-white">
          <div className="flex items-center gap-2 text-white/80">
            <Wallet className="h-5 w-5" />
            <span className="text-sm">{t('balance')}</span>
          </div>
          <p className="mt-2 text-display font-bold leading-none">{formatJOD(balance, lang)}</p>
          <p className="mt-4 flex items-center gap-2 text-sm text-white/80">
            <Sparkles className="h-4 w-4" />
            {t('earnNote')}
          </p>
        </div>

        {/* Top up */}
        <div>
          <h2 className="text-xl">{t('topUpTitle')}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TOPUP_AMOUNTS.map((amount) => {
              const bonus = reloadBonus(amount);
              return (
                <button
                  key={amount}
                  type="button"
                  onClick={() => topUp(amount)}
                  className="flex flex-col items-center gap-1 rounded-lg border border-neutral-warm bg-card p-4 shadow-card transition-colors hover:border-primary"
                >
                  <span className="text-lg font-bold text-primary">{formatJOD(amount, lang)}</span>
                  {bonus > 0 && (
                    <span className="rounded-pill bg-accent-light px-2 py-0.5 text-xs font-bold text-primary-dark">
                      {t('bonusBeans', { beans: formatNumber(bonus, lang) })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <h2 className="mt-8 text-xl">{t('historyTitle')}</h2>
          <div className="mt-4 divide-y divide-neutral-warm rounded-lg border border-neutral-warm bg-card px-4">
            {history.length === 0 ? (
              <p className="py-6 text-text-secondary">{t('noHistory')}</p>
            ) : (
              history.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-bold">{lang === 'ar' ? tx.labelAr : tx.labelEn}</p>
                    <p className="text-xs text-text-secondary">{formatDate(tx.createdAt, lang)}</p>
                  </div>
                  <span
                    className={`font-bold tabular-nums ${tx.amount >= 0 ? 'text-success' : 'text-error'}`}
                  >
                    {tx.amount >= 0 ? '+' : '−'}
                    {formatJOD(Math.abs(tx.amount), lang)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
