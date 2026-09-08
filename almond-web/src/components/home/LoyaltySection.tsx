import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

export function LoyaltySection() {
  const t = useTranslations('Home.loyalty');

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
        </div>
      </div>
    </section>
  );
}
