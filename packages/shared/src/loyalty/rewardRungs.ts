import { config } from '../config';

/**
 * THE REDEMPTION LADDER — one definition, for the app and the website.
 *
 * It lived only in `almond-app/services/rewardCatalogue.ts`, and the website
 * kept a second board of its own (100 / 180 / 250 / 300 with "Free drink" and
 * "Free pastry"). Measured against the same menu the site serves, 250 points =
 * 2.500 JOD covers 4 of 69 drinks (5.8%) and 180 points = 1.800 JOD covers 4 of
 * 152 food items (2.6%) — so the website promised "a free drink" for a price
 * that buys an americano or a bottle of water, while the app deliberately calls
 * that same rung "Coffee or bakery" and puts a real handcrafted drink at 400.
 * The site's own copy says "one account across web and app", so those two
 * boards were one member's two contradictory offers.
 *
 * Hence: the rungs live here, both boards build from them, and each rung
 * carries the id of a REAL menu item it must cover so a test can check the
 * claim (C7 in almond-app/test/copy.test.ts).
 *
 * `points` and `labelKey` only — icons, images and message strings stay with
 * each client, because they are presentation and they differ.
 */
export interface RewardRungSpec {
  points: number;
  /** Stable id, and the locale key each client renders it with. */
  labelKey: string;
  type: 'free-item' | 'discount';
  /**
   * The cheapest real menu item this rung must cover, by id. Absent on the
   * customization rung, which buys an OPTION rather than an item and is checked
   * against the priced customization options instead.
   */
  benchmarkItemId?: string;
}

/**
 * The value a rung is worth, in JOD. 1 point = 1 qirsh exactly (measured on
 * 10,621 live redemptions), so this is just the points at the redemption rate.
 * Every card is a MAXIMUM: the member pays the difference if the item costs
 * more, which is why both boards carry a max-value hint.
 */
export const rungValueJod = (rung: RewardRungSpec): number =>
  rung.points / config.POINTS_PER_JOD_REDEEM;

export const REWARD_RUNGS: readonly RewardRungSpec[] = [
  // The first rung is config.FIRST_REWARD_POINTS IMPORTED, never retyped, so
  // the board cannot drift off it again. 138 points = 1.380 JOD covers 715 of
  // the menu's 827 priced customization options (86.5%).
  { points: config.FIRST_REWARD_POINTS, labelKey: 'customization', type: 'discount' },
  // 2.500 JOD. Named for what it actually covers — an americano or a bakery
  // item — and NOT "a free drink", which at this value is true of 4 drinks
  // out of 69.
  { points: 250, labelKey: 'brewedCoffee', type: 'free-item', benchmarkItemId: 'hot-americano' },
  // 4.000 JOD covers 67 of 69 drinks (97.1%), including the 3.950 frappe band.
  // THIS is the rung "a free drink" describes.
  { points: 400, labelKey: 'handcraftedDrink', type: 'free-item', benchmarkItemId: 'almond-frappe' },
  // 6.000 JOD — retail beans, the only rung that is a take-home object.
  {
    points: 600,
    labelKey: 'packagedCoffee',
    type: 'free-item',
    benchmarkItemId: 'turkish-coffee-blend-with-cardamom-250-g',
  },
] as const;
