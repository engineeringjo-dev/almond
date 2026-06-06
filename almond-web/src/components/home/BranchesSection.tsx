import { useTranslations } from 'next-intl';
import { getBranches } from '@/data/branches';
import { Link } from '@/i18n/navigation';
import { BranchesExplorer } from '@/components/branches/BranchesExplorer';

export function BranchesSection() {
  const t = useTranslations('Home.branches');
  const branches = getBranches();

  return (
    <section className="container-content py-xxl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xxl">{t('title')}</h2>
          <p className="mt-1 text-md text-text-secondary">{t('subtitle')}</p>
        </div>
        <Link
          href="/branches"
          className="shrink-0 text-sm font-bold text-primary hover:underline"
        >
          {t('viewAll')}
        </Link>
      </div>
      <div className="mt-6">
        <BranchesExplorer branches={branches} />
      </div>
    </section>
  );
}
