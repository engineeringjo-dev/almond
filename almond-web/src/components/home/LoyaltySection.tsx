import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

export function LoyaltySection() {
  const t = useTranslations('Home.loyalty');

  return (
    <section className="container-content py-xl">
      <div className="overflow-hidden rounded-xl bg-gradient-purple text-white">
        {/* The purple gradient's light end (#8478C0) gives white text only
            3.9:1; a 25% deep-violet veil lifts it to 5.2:1 (AA) while keeping
            the gradient visible. (color-mix, because Tailwind's `/25` opacity
            modifier emits nothing for colours defined as CSS variables.) */}
        <div className="grid items-center gap-8 bg-[color:color-mix(in_srgb,var(--color-primary-dark)_25%,transparent)] p-8 md:grid-cols-[1fr_auto] md:p-12">
          <div className="max-w-xl">
            <h2 className="text-xxl text-white">{t('title')}</h2>
            <p className="mt-3 text-md text-white">{t('text')}</p>
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
