import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/ui/Logo';

const EXPLORE = [
  { href: '/menu', key: 'menu' },
  { href: '/rewards', key: 'rewards' },
  { href: '/branches', key: 'branches' },
  { href: '/gifts', key: 'gifts' },
] as const;

export function Footer() {
  const t = useTranslations('Footer');
  const nav = useTranslations('Nav');
  const year = new Date().getFullYear();

  return (
    <footer className="mt-xxl bg-gradient-dark text-white">
      <div className="container-content grid gap-8 py-xxl md:grid-cols-[1.4fr_1fr]">
        <div className="max-w-md">
          <Logo variant="light" className="h-10" />
          <p className="mt-4 text-md text-white/80">{t('tagline')}</p>
          <p className="mt-2 text-sm text-white/60">{t('madeIn')}</p>
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white/70">
            {t('explore')}
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {EXPLORE.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="text-md text-white/90 transition-colors duration-base hover:text-white"
                >
                  {nav(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="container-content py-5 text-sm text-white/60">
          © {year} {t('company')}. {t('rights')}
        </div>
      </div>
    </footer>
  );
}
