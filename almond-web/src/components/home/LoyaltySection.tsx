import { useLocale, useTranslations } from 'next-intl';
import { earnRangeCopy } from '@almond/shared/loyalty/earn';
import { Button } from '@/components/ui/Button';
import { asLang } from '@/lib/format';

/**
 * The most an ordinary day pays, then the programme in one line — both read off
 * the tiers and the wallet dial (earnRangeCopy). It said «كل 10 طلبات تساوي
 * مشروبًا مجانيًا» under «كوب المكافآت يمتلئ مع كل طلب», a stamp card this
 * programme has never run, and then «نقاطك نقود». Owner, 2026-10-15: «ازل …
 * الوعود … نقاط ٢- ٦% واحيانا × ١.٥ اذا كان مستخدم للبطاقات», and later the
 * same day «لا نستخدم نقاطك نقود. ممكن نحكي كاش باك لغاية ٩%».
 */
export function LoyaltySection() {
  const t = useTranslations('Home.loyalty');
  const lang = asLang(useLocale());
  const range = earnRangeCopy(lang);

  return (
    <section className="container-content py-xl">
      {/* The black card: white is 18.9:1 on it. */}
      <div className="overflow-hidden rounded-xl bg-primary-dark text-white">
        <div className="grid items-center gap-8 p-8 md:grid-cols-[1fr_auto] md:p-12">
          <div className="max-w-xl">
            <h2 className="text-xxl text-white">{t('title', range)}</h2>
            <p className="mt-3 text-md text-white">{t('text', range)}</p>
            <div className="mt-6">
              <Button href="/rewards" variant="onDark" size="lg">
                {t('cta')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
