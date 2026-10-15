import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

/**
 * The home hero + order CTA (handoff sitemap: Home hero). Black, like the
 * shops' facades and ceilings (owner, 2026-10-15: «المحل اندستريا واجهاته
 * وسقفه اسود») — it was the pastel rainbow gradient. White text is 18.9:1.
 * No pill above the heading: the heading carries the page (impeccable
 * craft-floor — an eyebrow over a heading is a template, not a design).
 */
export function Hero() {
  const t = useTranslations('Home.hero');

  return (
    <section className="bg-primary-dark">
      <div className="container-content grid items-center gap-10 py-xxl md:grid-cols-[1.3fr_0.7fr] md:py-20">
        <div className="max-w-2xl text-white">
          <h1 className="text-[34px] font-bold leading-tight md:text-[46px]">
            {t('title')}
          </h1>
          <p className="mt-4 max-w-xl text-lg">{t('subtitle')}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button href="/menu" size="lg" variant="onDark">
              {t('cta')}
            </Button>
            <Button href="/rewards" size="lg" variant="onDarkOutline">
              {t('ctaSecondary')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
