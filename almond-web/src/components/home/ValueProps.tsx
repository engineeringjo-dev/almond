import { useTranslations } from 'next-intl';
import { Coffee, Gift, MapPin } from 'lucide-react';

export function ValueProps() {
  const t = useTranslations('Home.value');

  const items = [
    { Icon: Coffee, title: t('menuTitle'), text: t('menuText') },
    { Icon: Gift, title: t('beansTitle'), text: t('beansText') },
    { Icon: MapPin, title: t('pickupTitle'), text: t('pickupText') },
  ];

  return (
    <section className="container-content grid gap-4 py-xl sm:grid-cols-3">
      {items.map(({ Icon, title, text }) => (
        <div
          key={title}
          className="flex items-start gap-4 rounded-lg border border-neutral-warm bg-card p-5 shadow-card"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-neutral-warm text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-md font-bold">{title}</h3>
            <p className="mt-1 text-sm text-text-secondary">{text}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
