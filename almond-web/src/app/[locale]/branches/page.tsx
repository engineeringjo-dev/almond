import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getBranches } from '@/data/branches';
import { BranchesExplorer } from '@/components/branches/BranchesExplorer';

export const metadata: Metadata = { title: 'Branches' };

export default function BranchesPage() {
  const t = useTranslations('Home.branches');
  const branches = getBranches();

  return (
    <div className="container-content py-xl">
      <h1 className="text-xxl">{t('title')}</h1>
      <p className="mt-1 text-md text-text-secondary">{t('subtitle')}</p>
      <div className="mt-6">
        <BranchesExplorer branches={branches} />
      </div>
    </div>
  );
}
