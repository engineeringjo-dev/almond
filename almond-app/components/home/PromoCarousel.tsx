import { ComboOfferCard } from '@/components/home/ComboOfferCard';
import { CampaignSlideCard } from '@/components/home/CampaignSlideCard';
import { CampaignPager } from '@/components/home/CampaignPager';
import { config } from '@/constants/config';
import { useWalletRate } from '@/hooks/useWalletRate';
import { useMenuState } from '@/hooks/useMenuState';
import { campaignCollection, campaignSlides } from '@/lib/campaignSlides';

/** Owner-requested discovery, after membership, Order and the usual order.
 * Manual only; each photograph hands off to an actual menu/contact journey. */
export function PromoCarousel() {
  const { extraPercent } = useWalletRate();
  const menu = useMenuState();
  const collection = campaignCollection('keto-gluten-free', menu.categories, menu.items);
  // earn-arith-exempt: choosing a presentation from the configured LABEL. §7 T7.
  const slides = campaignSlides(config.COMBO_BONUS_POINTS, extraPercent, !!collection);
  return (
    <CampaignPager
      ids={slides.map((slide) => slide.id)}
      renderSlide={(index, active) => slides[index].id === 'combo' && active
        ? <ComboOfferCard inCarousel />
        : <CampaignSlideCard slide={slides[index]} active={active} extraPercent={extraPercent} />}
    />
  );
}
