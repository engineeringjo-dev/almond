import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { CareersForm } from '@/components/careers/CareersForm';

export const metadata: Metadata = { title: 'Careers' };

export default function CareersPage() {
  const t = useTranslations('Careers');
  return (
    <div className="container-content py-xl">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xxl">{t('title')}</h1>
        <p className="mt-1 text-md text-text-secondary">{t('subtitle')}</p>
        <p className="mt-4 text-md">{t('intro')}</p>
        <div className="mt-6">
          <CareersForm />
        </div>
      </div>
    </div>
  );
}
