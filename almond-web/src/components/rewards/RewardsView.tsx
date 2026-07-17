'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Sparkles } from 'lucide-react';
import { useLoyaltyStore } from '@/store/loyaltyStore';
import { REWARDS, tierProgress } from '@/data/loyalty';
import { Cup } from '@/components/ui/Cup';
import { asLang, formatDate, formatJOD, formatNumber } from '@/lib/format';
import { readableTextOn } from '@/lib/contrast';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';

export function RewardsView() {
  const t = useTranslations('Rewards');
  const lang = asLang(useLocale());

  const points = useLoyaltyStore((s) => s.points);
  const windowSpend = useLoyaltyStore((s) => s.windowSpend);
  const cup = useLoyaltyStore((s) => s.cup);
  const vouchers = useLoyaltyStore((s) => s.vouchers);
  const history = useLoyaltyStore((s) => s.pointsHistory);
  const redeemReward = useLoyaltyStore((s) => s.redeemReward);

  const [mounted, setMounted] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <PageSkeleton />;

  const tp = tierProgress(windowSpend);
  const tr = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const nextTierLabel = tp.next
    ? t('toNextTier', { amount: formatJOD(tp.remaining, lang), tier: tr(tp.next.nameAr, tp.next.nameEn) })
    : t('topTier');

  const onRedeem = (id: string, cost: number) => {
    const reward = REWARDS.find((r) => r.id === id);
    if (reward && redeemReward(reward)) {
      setFlash(id);
      window.setTimeout(() => setFlash(null), 1500);
    }
  };

  return (
    <div className="container-content py-xl">
      <h1 className="text-xxl">{t('title')}</h1>

      {/* Balance + tier + cup */}
      <div className="mt-6 grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl bg-gradient-purple p-6 text-white">
          <p className="text-sm text-white/80">{t('yourBeans')}</p>
          <p className="mt-1 text-display font-bold leading-none">{formatNumber(points, lang)}</p>
          <p className="mt-1 text-sm text-white/80">{t('beans')}</p>

          <div className="mt-5">
            <div className="flex items-center justify-between text-sm">
              <span
                className="rounded-pill px-3 py-1 font-bold"
                style={{ backgroundColor: tp.current.color, color: readableTextOn(tp.current.color) }}
              >
                {tr(tp.current.nameAr, tp.current.nameEn)}
              </span>
              <span className="text-white/80">{nextTierLabel}</span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-pill bg-white/25"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(tp.ratio * 100)}
              aria-label={nextTierLabel}
            >
              <div className="h-full rounded-pill bg-white" style={{ width: `${tp.ratio * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-neutral-warm bg-card p-6 shadow-card">
          <div className="w-20 shrink-0 text-primary">
            <Cup current={cup.current} target={cup.target} decorative />
          </div>
          <p className="text-sm text-text-secondary">
            {t('cupProgress', {
              current: formatNumber(cup.current, lang),
              target: formatNumber(cup.target, lang),
            })}
          </p>
        </div>
      </div>

      <p className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        {t('earnRate')}
      </p>

      {/* Redeem */}
      <h2 className="mt-10 text-xl">{t('redeemTitle')}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {REWARDS.map((r) => {
          const affordable = points >= r.cost;
          const done = flash === r.id;
          return (
            <div
              key={r.id}
              className="flex flex-col rounded-lg border border-neutral-warm bg-card p-4 shadow-card"
            >
              <h3 className="font-bold">{tr(r.titleAr, r.titleEn)}</h3>
              <p className="mt-1 text-sm text-text-secondary">{t('cost', { cost: formatNumber(r.cost, lang) })}</p>
              <button
                type="button"
                disabled={!affordable || done}
                onClick={() => onRedeem(r.id, r.cost)}
                className={cn(
                  'mt-4 inline-flex h-10 items-center justify-center gap-1 rounded-pill px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  done
                    ? 'bg-success text-white'
                    : affordable
                      ? 'bg-primary text-white hover:bg-primary-dark'
                      : 'cursor-not-allowed bg-neutral-warm text-text-secondary',
                )}
              >
                {done ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden /> {t('redeemed')}
                  </>
                ) : affordable ? (
                  t('redeem')
                ) : (
                  t('notEnough')
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {/* Vouchers */}
        <section>
          <h2 className="text-xl">{t('vouchersTitle')}</h2>
          <div className="mt-4 space-y-3">
            {vouchers.length === 0 ? (
              <p className="text-text-secondary">{t('noVouchers')}</p>
            ) : (
              vouchers.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-lg border border-dashed border-primary bg-accent-light px-4 py-3"
                >
                  <div>
                    <p className="font-bold text-primary-dark">{tr(v.titleAr, v.titleEn)}</p>
                    <p className="text-xs text-text-secondary">
                      {t('expires', { date: formatDate(v.expiresAt, lang) })}
                    </p>
                  </div>
                  {v.type === 'credit' && v.value != null && (
                    <span className="font-bold text-primary-dark">{formatJOD(v.value, lang)}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Activity */}
        <section>
          <h2 className="text-xl">{t('activityTitle')}</h2>
          <div className="mt-4 divide-y divide-neutral-warm rounded-lg border border-neutral-warm bg-card px-4">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-bold">{tr(h.reasonAr, h.reasonEn)}</p>
                  <p className="text-xs text-text-secondary">{formatDate(h.createdAt, lang)}</p>
                </div>
                <span
                  className={cn('font-bold tabular-nums', h.deltaPoints >= 0 ? 'text-success' : 'text-error')}
                >
                  {h.deltaPoints >= 0 ? '+' : ''}
                  {formatNumber(h.deltaPoints, lang)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
