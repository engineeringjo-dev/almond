import { useTranslations } from 'next-intl';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';

/**
 * Placeholder for sitemap routes that are scaffolded in the nav but built in a
 * later section (menu → cart → checkout → rewards/wallet/gifts). Keeps links
 * from 404-ing while clearly marking the section as upcoming.
 */
export function ComingSoon({ titleKey }: { titleKey: string }) {
  const nav = useTranslations('Nav');
  const common = useTranslations('Common');

  return (
    <section className="container-content flex min-h-[60vh] flex-col items-center justify-center gap-6 py-xxl text-center">
      <Logo className="h-10" />
      <div className="space-y-2">
        <h1 className="text-xxl">{nav(titleKey)}</h1>
        <p className="text-md text-text-secondary">{common('comingSoon')}</p>
      </div>
      <Button href="/" variant="outline" size="md">
        {nav('home')}
      </Button>
    </section>
  );
}
