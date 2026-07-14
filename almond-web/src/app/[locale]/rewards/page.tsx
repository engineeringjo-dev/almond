import type { Metadata } from 'next';
import { RewardsView } from '@/components/rewards/RewardsView';

export const metadata: Metadata = { title: 'Rewards' };

export default function RewardsPage() {
  return <RewardsView />;
}
