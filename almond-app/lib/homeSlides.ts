import type { Href } from 'expo-router';

import { bestSellers } from '@almond/shared/lib/recommendations';
import { itemFromPrice } from '@almond/shared/menu';
import type { IconName } from '@/components/ui/Icon';
import type { Lang, MenuItem } from '@/types';

/** A sentence from the locale files, in the reader's language. */
export interface SlideText {
  key: string;
  params?: Record<string, string | number>;
}

/** Words on a slide: a locale sentence, or data already in the reader's
 *  language (an item's own name, a formatted price). */
export type SlideWords = SlideText | { text: string };

export type SlideAction =
  | { kind: 'item'; itemId: string }
  | { kind: 'route'; href: Href };

/**
 * One actionable member-offer slide on /campaigns, apart from the stationary
 * combo campaign, which is its own component (ComboOfferCard).
 *
 * A slide is either a menu item, named by the item's own name, or a programme
 * fact stated by a locale key. It never carries a literal in either language:
 * a literal is invisible to every copy test, and that is how three retired
 * mechanics lived on the old offers strip (bff/test/copy.test.ts, C14).
 */
export interface HomeSlide {
  id: string;
  title: SlideWords;
  subtitle?: SlideWords;
  cta: SlideWords;
  /** Menu photo path; none falls back to `icon`. */
  photo?: string;
  icon?: IconName;
  action: SlideAction;
}

export interface SlideContext {
  lang: Lang;
  /** The live menu (useMenuState), not the bundled seed: it changes daily. */
  items: readonly MenuItem[];
  /** The member's rate from the balance and otherwise (useWalletRate). */
  walletRate: { rate: string; base: string };
  /** The ladder in one line (earnRangeCopy). */
  range: { low: string; high: string; mult: string; max: string };
  /** The price, formatted: «3.950 د.أ». */
  formatPrice: (jod: number) => string;
}

/**
 * THE SLIDES, IN ORDER: the most ordered drink, the most ordered food, then
 * what the programme pays — paying from the balance, gift cards, points.
 *
 * Best sellers are measured (bestSellers in @almond/shared, paid Odoo orders),
 * so «من الأكثر طلباً» under a photograph is true. They lead because a
 * photograph of something to drink is what makes a member want to order.
 * These are actual menu items and prices, separate from price-free campaign
 * serving suggestions.
 */
export function buildHomeSlides(ctx: SlideContext): HomeSlide[] {
  const slides: HomeSlide[] = [];

  for (const kind of ['drink', 'food'] as const) {
    const [item] = bestSellers(1, { kind, items: ctx.items });
    if (!item) continue;
    const price = ctx.formatPrice(itemFromPrice(item));
    slides.push({
      id: `best-${kind}`,
      title: { text: ctx.lang === 'ar' ? item.nameAr : item.nameEn },
      subtitle: { key: 'home.mostOrdered' },
      // «من 3.250 د.أ» when the sizes differ in price, the price alone when
      // there is one size: the same rule as the menu tiles.
      cta: item.sizes.length > 1 ? { key: 'menu.fromPrice', params: { price } } : { text: price },
      photo: item.imageUrl,
      action: { kind: 'item', itemId: item.id },
    });
  }

  slides.push(
    {
      id: 'wallet',
      title: { key: 'home.walletHint', params: ctx.walletRate },
      cta: { key: 'home.topUpWallet' },
      icon: 'wallet',
      action: { kind: 'route', href: '/profile/wallet' },
    },
    {
      id: 'gift',
      title: { key: 'gift.title' },
      subtitle: { key: 'gift.subtitle' },
      cta: { key: 'gift.sendTitle' },
      icon: 'gift',
      action: { kind: 'route', href: '/profile/gift-cards' },
    },
    {
      id: 'rewards',
      title: { key: 'rewards.headline', params: { max: ctx.range.max } },
      subtitle: { key: 'home.rewardsSlide', params: { low: ctx.range.low, high: ctx.range.high, mult: ctx.range.mult } },
      cta: { key: 'rewards.howItWorks' },
      icon: 'cashback',
      action: { kind: 'route', href: '/(tabs)/rewards' },
    },
  );

  return slides;
}
