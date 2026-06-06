import { useTranslations } from 'next-intl';
import { getBranches } from '@/data/branches';
import { Link } from '@/i18n/navigation';
import { BranchCard } from './BranchCard';

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
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((branch) => (
          <BranchCard key={branch.id} branch={branch} />
        ))}
      </div>
    </section>
  );
}
