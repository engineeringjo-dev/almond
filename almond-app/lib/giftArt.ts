import type { ImageSourcePropType } from 'react-native';

/**
 * The artwork file for each gift design (packages/shared/src/gifts/designs.ts).
 * Metro needs a literal require per file, so this map is written out by hand;
 * test/gift-designs.test.ts fails if a design has no entry or no file.
 */
export const GIFT_ART: Record<string, ImageSourcePropType> = {
  ar01: require('../assets/gift-cards/ar01.webp'),
  ar02: require('../assets/gift-cards/ar02.webp'),
  ar03: require('../assets/gift-cards/ar03.webp'),
  ar04: require('../assets/gift-cards/ar04.webp'),
  ar05: require('../assets/gift-cards/ar05.webp'),
  en01: require('../assets/gift-cards/en01.webp'),
  en02: require('../assets/gift-cards/en02.webp'),
  en03: require('../assets/gift-cards/en03.webp'),
  en04: require('../assets/gift-cards/en04.webp'),
  en05: require('../assets/gift-cards/en05.webp'),
  en06: require('../assets/gift-cards/en06.webp'),
};
