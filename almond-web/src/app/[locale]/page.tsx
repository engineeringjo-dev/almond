import { Hero } from '@/components/home/Hero';
import { ValueProps } from '@/components/home/ValueProps';
import { FeaturedRow } from '@/components/home/FeaturedRow';
import { LoyaltySection } from '@/components/home/LoyaltySection';
import { BranchesSection } from '@/components/home/BranchesSection';

export default function HomePage() {
  return (
    <>
      <Hero />
      <ValueProps />
      <FeaturedRow />
      <LoyaltySection />
      <BranchesSection />
    </>
  );
}
