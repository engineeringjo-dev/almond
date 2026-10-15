import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { contactLinks } from '@almond/shared/lib/phone';
import { config } from '@/lib/config';

export const metadata: Metadata = { title: 'Delete your account' };

/**
 * DELETE YOUR ACCOUNT — the web page Google Play requires an app's store
 * listing to link to, so a member can ask without the app installed.
 *
 * The rule is @almond/shared/loyalty/accountDeletion (owner, 2026-10-15): the
 * profile is erased after the grace period; the phone, points, wallet balance,
 * orders and invoices stay. The same words as the app's
 * app/profile/delete-account.tsx, so the two never promise different things.
 */
export default function DeleteAccountPage() {
  const t = useTranslations('DeleteAccount');
  const contact = contactLinks(config.CONTACT_PHONE_E164);
  const days = config.ACCOUNT_DELETION_GRACE_DAYS;
  // The request typed for them; they still send it from their own number,
  // which is how the call centre knows whose account it is.
  const whatsapp = `${contact.whatsapp}?text=${encodeURIComponent(t('whatsappText'))}`;
  return (
    <div className="container-content py-xl">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xxl">{t('title')}</h1>
        <section className="mt-6">
          <h2 className="text-xl">{t('goesTitle')}</h2>
          <p className="mt-2 text-md text-text-secondary">{t('goesBody')}</p>
        </section>
        <section className="mt-6">
          <h2 className="text-xl">{t('staysTitle')}</h2>
          <p className="mt-2 text-md text-text-secondary">{t('staysBody')}</p>
        </section>
        <section className="mt-6">
          <h2 className="text-xl">{t('whenTitle')}</h2>
          <p className="mt-2 text-md text-text-secondary">{t('whenBody', { days })}</p>
        </section>
        <section className="mt-8">
          <h2 className="text-xl">{t('howTitle')}</h2>
          <ol className="mt-2 list-decimal space-y-2 ps-6 text-md">
            <li>{t('howApp')}</li>
            <li>
              {t('howContact')}{' '}
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="font-bold text-primary-dark underline underline-offset-4">
                {t('whatsapp')}
              </a>{' '}
              ·{' '}
              <a href={contact.tel} className="font-bold text-primary-dark underline underline-offset-4">
                {t('call')} <span dir="ltr">{contact.display}</span>
              </a>
            </li>
          </ol>
        </section>
      </div>
    </div>
  );
}
