import { campaignPhotos } from './campaignPhotos';

/** Literal requires keep the same authentic photos available on native/web. */
export const campaignSlidePhotos = {
  combo: campaignPhotos.americanoCookie,
  giftAr: require('../../assets/gift-cards/ar02.webp'),
  giftEn: require('../../assets/gift-cards/en01.webp'),
  wallet: campaignPhotos.cup,
  catering: campaignPhotos.catering,
  'gift-box': require('../../assets/menu/gift-box.jpg'),
  'design-cakes': require('../../public/menu/p-10307.webp'),
  'keto-gluten-free': require('../../public/menu/p-10278.webp'),
} as const;
