import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Cup } from '@/components/ui/Cup';

/** Signature rainbow loyalty banner + order CTA (handoff sitemap: Home hero). */
export function Hero() {
  const t = useTranslations('Home.hero');

  return (
    <section className="bg-gradient-rainbow">
      <div className="container-content grid items-center gap-10 py-xxl md:grid-cols-[1.3fr_0.7fr] md:py-20">
        <div className="max-w-2xl text-primary-dark">
          <span className="inline-flex items-center gap-2 rounded-pill bg-white/70 px-4 py-1.5 text-sm font-bold">
            <Sparkles className="h-4 w-4" />
            {t('badge')}
          </span>
          <h1 className="mt-5 text-[34px] font-bold leading-tight md:text-[46px]">
            {t('title')}
          </h1>
          <p className="mt-4 max-w-xl text-lg opacity-80">{t('subtitle')}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button href="/menu" size="lg">
              {t('cta')}
            </Button>
            <Button href="/rewards" size="lg" variant="outline">
              {t('ctaSecondary')}
            </Button>
          </div>
        </div>
        <div className="mx-auto w-40 text-primary-dark drop-shadow-sm md:w-56">
          <Cup current={6} decorative />
        </div>
      </div>
    </section>
  );
}
