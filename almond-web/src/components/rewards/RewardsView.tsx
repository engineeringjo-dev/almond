'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Sparkles } from 'lucide-react';
import { useLoyaltyStore } from '@/store/loyaltyStore';
import { tierName } from '@almond/shared/loyalty';
import { tierProgress } from '@/data/loyalty';
import { redeemOptions } from '@almond/shared/loyalty/redeem';
// earn-arith-exempt: points→JOD for DISPLAY, via the one shared conversion. §7 T7.
import { jodFromPoints } from '@almond/shared/loyalty/earn';
import { Cup } from '@/components/ui/Cup';
import { asLang, formatDate, formatJOD, formatNumber } from '@/lib/format';
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

  if (!mounted) return <div className="container-content min-h-[50vh] py-xl" />;

  const tp = tierProgress(windowSpend);
  const tr = (ar: string, en: string) => (lang === 'ar' ? ar : en);

  // Built from the BALANCE, by the same function almond-app calls, so one
  // member is never offered two different sets of choices. The board this
  // replaces is documented in data/loyalty.ts.
  const options = redeemOptions(points);

  const onRedeem = (id: string) => {
    const option = options.find((o) => o.id === id);
    if (option && redeemReward(option)) {
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
                className="rounded-pill px-3 py-1 font-bold text-white"
                style={{ backgroundColor: tp.current.color }}
              >
                {tierName(tp.current, lang)}
              </span>
              <span className="text-white/80">
                {tp.next
                  ? // A DEFINITE sentence only where the count is a GUARANTEE.
                    // `visitsGuaranteed` was produced in data/loyalty.ts and read
                    // by nobody: this line stated a 5.85 JOD spend PROJECTION as
                    // a promise, so a member 60 JOD into the 65 JOD rung was told
                    // "1 more visits to reach 6%", came back for a 2.500 JOD
                    // americano, landed at 62.5 and was still paid 4%. That is
                    // the exact defect the app fixed in tierCopy.ts; the website
                    // had the flag and no branch to spend it on.
                    t(tp.visitsGuaranteed ? 'toNextTier' : 'toNextTierEstimate', {
                      visits: tp.visitsRemaining,
                      tier: tierName(tp.next, lang),
                    })
                  : t('topTier', { tier: tierName(tp.current, lang) })}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-pill bg-white/25">
              <div className="h-full rounded-pill bg-white" style={{ width: `${tp.ratio * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-neutral-warm bg-card p-6 shadow-card">
          <div className="w-20 shrink-0 text-primary">
            <Cup current={cup.current} target={cup.target} />
          </div>
          <p className="text-sm text-text-secondary">
            {t('cupProgress', { current: cup.current, target: cup.target })}
          </p>
        </div>
      </div>

      <p className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
        <Sparkles className="h-4 w-4 text-primary" />
        {t('earnRate', { rate: tierName(tp.current, lang) })}
      </p>

      {/* Redeem — an AMOUNT off the bill, not a board of named rewards.
          Every card here used to carry `maxValueHint` ("value is a max, pay the
          difference"), because a rung was a cap on a named item. A credit is
          exact money, so the caveat is gone rather than restyled. */}
      <h2 className="mt-10 text-xl">{t('redeemTitle')}</h2>
      <p className="mt-1 text-sm text-text-secondary">{t('redeemHint')}</p>

      <div className="mt-4 rounded-xl border border-neutral-warm bg-card p-6 shadow-card">
        <p className="text-sm text-text-secondary">{t('worthNow')}</p>
        <p className="mt-1 text-display font-bold leading-none">
          {formatJOD(jodFromPoints(points), lang)}
        </p>

        {options.length === 0 ? (
          <p className="mt-4 text-sm text-text-secondary">{t('noPointsYet')}</p>
        ) : (
          <div className="mt-5 flex flex-wrap gap-3">
            {options.map((o) => {
              const done = flash === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={done}
                  onClick={() => onRedeem(o.id)}
                  aria-label={t('redeemA11y', { jod: formatJOD(o.jod, lang), points: o.points })}
                  className={cn(
                    'flex min-w-[7rem] flex-1 flex-col items-center gap-0.5 rounded-lg px-4 py-3',
                    'text-sm transition-colors',
                    done
                      ? 'bg-success text-white'
                      : 'bg-neutral-warm text-primary hover:bg-primary hover:text-white',
                  )}
                >
                  <span className="inline-flex items-center gap-1 font-bold">
                    {done && <Check className="h-4 w-4" />}
                    {done ? t('redeemed') : formatJOD(o.jod, lang)}
                  </span>
                  {!done && (
                    <span className="text-xs opacity-80">
                      {o.full ? t('wholeBalance') : t('cost', { cost: o.points })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
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
                    <p className="font-bold text-primary">{tr(v.titleAr, v.titleEn)}</p>
                    <p className="text-xs text-text-secondary">
                      {t('expires', { date: formatDate(v.expiresAt, lang) })}
                    </p>
                  </div>
                  {v.type === 'credit' && v.value != null && (
                    <span className="font-bold text-primary">{formatJOD(v.value, lang)}</span>
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
