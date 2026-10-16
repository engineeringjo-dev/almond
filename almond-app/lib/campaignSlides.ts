import type { Category, MenuItem } from '@almond/shared/types';

export type CampaignSlideId = 'combo' | 'gift-card' | 'wallet' | 'catering' | 'gift-box' | 'design-cakes' | 'keto-gluten-free';
export interface CampaignSlide {
  id: CampaignSlideId;
  titleKey: string;
  bodyKey: string;
  actionKey: string;
  href: '/campaigns' | '/profile/gift-cards' | '/profile/wallet' | '/profile/help' | '/(tabs)/order';
  params?: { tab: 'menu'; collection: 'keto-gluten-free' };
}

/** Visible conditions also form the actual button name on native and web.
 * accessibilityHint alone is not exposed by react-native-web. */
export function campaignAccessibleLabel(title: string, body: string, action: string, exclusions = ''): string {
  return [title, body, exclusions, action].filter(Boolean).join('. ');
}

const DISCOVERY: CampaignSlide[] = [
  { id: 'gift-card', titleKey: 'giftTitle', bodyKey: 'giftBody', actionKey: 'giftAction', href: '/profile/gift-cards' },
  { id: 'wallet', titleKey: 'walletTitle', bodyKey: 'walletBody', actionKey: 'walletAction', href: '/profile/wallet' },
  { id: 'catering', titleKey: 'cateringTitle', bodyKey: 'cateringBody', actionKey: 'cateringAction', href: '/profile/help' },
  { id: 'gift-box', titleKey: 'giftBoxTitle', bodyKey: 'giftBoxBody', actionKey: 'contactAction', href: '/profile/help' },
  { id: 'design-cakes', titleKey: 'cakesTitle', bodyKey: 'cakesBody', actionKey: 'contactAction', href: '/profile/help' },
  { id: 'keto-gluten-free', titleKey: 'collectionTitle', bodyKey: 'collectionBody', actionKey: 'collectionAction', href: '/(tabs)/order', params: { tab: 'menu', collection: 'keto-gluten-free' } },
];

/** No stored poster prices, cart mutations or invented products. */
export function campaignSlides(comboPoints: number, walletExtra: number, collectionAvailable: boolean): CampaignSlide[] {
  const slides = DISCOVERY.filter((slide) => slide.id !== 'keto-gluten-free' || collectionAvailable).map((slide) => slide.id === 'wallet' && !(walletExtra > 0)
    ? { ...slide, titleKey: 'walletPlainTitle', bodyKey: 'walletPlainBody' }
    : { ...slide });
  if (Number.isFinite(comboPoints) && comboPoints > 0) slides.unshift({
    id: 'combo', titleKey: 'comboTitle', bodyKey: 'comboBody', actionKey: 'comboAction', href: '/campaigns',
  });
  return slides;
}

/** Only this explicit collection is supported. Category identity comes from
 * current menu metadata; no item is inferred to be allergen-safe. */
export function campaignCollection(
  raw: string | string[] | undefined,
  categories: readonly Category[],
  items: readonly MenuItem[],
): { categories: Category[]; items: MenuItem[] } | null {
  if (raw !== 'keto-gluten-free') return null;
  const selected = categories.filter((category) => /keto|gluten[ -]?free/i.test(category.nameEn));
  const ids = new Set(selected.map((category) => category.id));
  const found = items.filter((item) => ids.has(item.categoryId));
  return found.length ? { categories: selected, items: found } : null;
}

/** The physical scroll track is always LTR. Reversing its data gives Arabic
 * the requested finger-right advance without platform-specific RTL offsets. */
export function physicalSlide(logical: number, count: number, rtl: boolean): number {
  return rtl ? count - 1 - logical : logical;
}
export function logicalSlide(offset: number, width: number, count: number, rtl: boolean): number {
  if (!(width > 0) || count < 1) return 0;
  const physical = Math.max(0, Math.min(count - 1, Math.round(offset / width)));
  return physicalSlide(physical, count, rtl);
}
