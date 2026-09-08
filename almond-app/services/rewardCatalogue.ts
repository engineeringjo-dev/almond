import type { IconName } from '@/components/ui/Icon';
import { REWARD_RUNGS, type RewardRungSpec } from '@almond/shared/loyalty/rewardRungs';
import { menuItems } from '@/services/seed';

/**
 * THE REDEMPTION LADDER — what a member can actually take, and at what price.
 *
 * It was 25 / 60 / 100 / 200 / 300 / 400, modelled on Starbucks' catalogue, and
 * measured against THIS menu (237 priced items, 827 priced customization
 * options in packages/shared/src/menu/menu.generated.ts) four of those six
 * rungs named something their own value could not buy:
 *
 *   - 25 points  = 0.250 JOD → covers 39 of 827 customization options (4.7%)
 *                  and ZERO items; the modal option delta is 0.400.
 *   - 60 points  = 0.600 JOD → "Flat discount on any item", against a menu whose
 *                  CHEAPEST item is 0.750. It buys nothing at all.
 *   - 100 points = 1.000 JOD → below config.FIRST_REWARD_POINTS (138), which the
 *                  config comment rejects by name.
 *   - 200 points = 2.000 JOD → "Handcrafted drink", against a 3.950 frappe band.
 *   - 300 points = 3.000 JOD → "Brunch plate", against a 3.900 sandwich band.
 *
 * The four rungs below land on real prices, and each one is a visible step up in
 * what the board can actually buy: 1.3% → 15.2% → 71.3% → 90.3% of the priced
 * menu. The first rung is `config.FIRST_REWARD_POINTS` IMPORTED, not retyped, so
 * the catalogue cannot drift off it again — 138 points = 1.380 JOD covers 715 of
 * the 827 priced customization options (86.5%).
 *
 * `benchmarkItemId` is the claim each rung makes, in a form a test can check:
 * the cheapest real menu item the rung is supposed to cover. C7 in
 * almond-app/test/copy.test.ts looks the price up and fails if a card ever names
 * something its own value cannot buy again.
 *
 * THE RUNGS THEMSELVES NOW LIVE IN `@almond/shared/loyalty/rewardRungs`. They
 * were app-only, and almond-web kept a second board (100/180/250/300, "Free
 * drink" at the rung this one calls "Coffee or bakery") that the same member
 * sees on the same account. One ladder, two presentations; only the icons, the
 * photos and the locale keys are chosen here.
 */
export interface RewardRung extends RewardRungSpec {
  /** The locale key this card renders — `rewardItems.<labelKey>` of the shared
   *  rung, resolved here because the key namespace is the client's. */
  labelKey: string;
  icon: IconName;
  image?: string;
}

/** A representative real product photo for each reward (temporary where the
 *  exact reward item has none) — falls back to the first photographed item. */
const rewardImg = (re: RegExp): string | undefined =>
  (menuItems.find((i) => i.imageUrl && re.test(i.nameEn)) ??
    menuItems.find((i) => i.imageUrl))?.imageUrl;

/** Icon per shared rung. The RUNGS (points, type, benchmark) are
 *  @almond/shared/loyalty/rewardRungs — one ladder for the app and the website,
 *  because they are one account. Only presentation is chosen here. */
const ICONS: Record<string, IconName> = {
  customization: 'plus',
  brewedCoffee: 'coffee',
  handcraftedDrink: 'cold',
  packagedCoffee: 'cake',
};

const IMAGE_HINT: Record<string, RegExp> = {
  customization: /syrup|caramel|vanilla|shot|latte/i,
  brewedCoffee: /americano|brew|drip|filter|coffee/i,
  handcraftedDrink: /latte|frappe|iced|spanish/i,
  packagedCoffee: /beans|whole bean|packaged/i,
};

export const rewardCatalogue: RewardRung[] = REWARD_RUNGS.map((rung) => ({
  ...rung,
  labelKey: `rewardItems.${rung.labelKey}`,
  icon: ICONS[rung.labelKey] ?? 'coffee',
  image: rewardImg(IMAGE_HINT[rung.labelKey] ?? /coffee/i),
}));
