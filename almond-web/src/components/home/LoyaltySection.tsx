import { useTranslations } from 'next-intl';
import { Cup } from '@/components/ui/Cup';
import { Button } from '@/components/ui/Button';
import { config } from '@/lib/config';

export function LoyaltySection() {
  const t = useTranslations('Home.loyalty');
  const current = 6;
  const target = config.CUP_TARGET;

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
              <Cup current={current} target={target} />
            </div>
            <span className="rounded-pill bg-white/15 px-4 py-1.5 text-sm font-bold">
              {t('cupLabel', { current, target })}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
