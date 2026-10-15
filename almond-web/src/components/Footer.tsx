import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/ui/Logo';
import { contactLinks } from '@almond/shared/lib/phone';
import { config } from '@/lib/config';

const EXPLORE = [
  { href: '/menu', key: 'menu' },
  { href: '/rewards', key: 'rewards' },
  { href: '/branches', key: 'branches' },
  { href: '/gifts', key: 'gifts' },
] as const;

const COMPANY = [
  { href: '/careers', key: 'careers' },
  { href: '/franchise', key: 'franchise' },
  // Google Play requires a web page for account deletion.
  { href: '/account/delete', key: 'deleteAccount' },
] as const;

export function Footer() {
  const t = useTranslations('Footer');
  const nav = useTranslations('Nav');
  const year = new Date().getFullYear();
  // The unified call centre and WhatsApp line (owner, 2026-10-15) — the same
  // dial and the same links as the app's help screen.
  const contact = contactLinks(config.CONTACT_PHONE_E164);

  return (
    // The dark gradient starts at brand violet (#6C5CB4): white at 60–80%
    // opacity measures 3.1–4.2:1 there, under AA for body text. Secondary text
    // is white/90 (≥4.8:1 across the gradient).
    <footer className="mt-xxl bg-gradient-dark text-white">
      <div className="container-content grid gap-8 py-xxl md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="max-w-md">
          <Logo variant="light" className="h-10" />
          <p className="mt-4 text-md text-white/90">{t('tagline')}</p>
          <p className="mt-2 text-sm text-white/90">{t('madeIn')}</p>
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white/90">
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
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white/90">
            {t('companyTitle')}
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {COMPANY.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="text-md text-white/90 transition-colors duration-base hover:text-white"
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white/90">
            {t('contactTitle')}
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            <li>
              <a
                href={contact.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="text-md text-white/90 transition-colors duration-base hover:text-white"
              >
                {t('whatsapp')}
              </a>
            </li>
            <li>
              <a
                href={contact.tel}
                className="text-md text-white/90 transition-colors duration-base hover:text-white"
              >
                {t('call')}{' '}
                <bdi dir="ltr">{contact.display}</bdi>
              </a>
            </li>
            <li className="text-sm text-white/90">{t('hours')}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="container-content py-5 text-sm text-white/90">
          © {year} {t('company')}. {t('rights')}
        </div>
      </div>
    </footer>
  );
}
