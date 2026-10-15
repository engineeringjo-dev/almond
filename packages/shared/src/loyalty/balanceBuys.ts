/**
 * WHAT THE BALANCE BUYS NOW (Dunkin' panel, 2026-10-15).
 *
 * Dunkin's catalogue turns a number into a product (800 points, a donut). Ours
 * keeps points as money (owner, 2026-09-08: «نقاطك نقود», spent against any
 * bill, no board, no threshold), so the rewards screen said «1,240» and left
 * the member to work out what that is. This says it in the menu's own terms:
 * the most-ordered drink, and how many of it the balance pays for in full —
 * «تكفي 3× آيس سبانيش لاتيه».
 *
 * 🔴 ONLY WHAT IT COVERS NOW. Below the price of one there is no sentence:
 * never «ينقصك 40 نقطة لـ…», which is a threshold under another name, and
 * the redemption has none (loyalty/redeem.ts). Counted in whole fils, so a
 * balance of exactly two drinks says two.
 */
import { bestSellers } from '../lib/recommendations';
import { itemFromPrice } from '../menu/pricing';
import type { MenuItem } from '../types';
import { jodFromPoints } from './earn';

export function balanceBuys(
  points: number,
  opts: { items?: readonly MenuItem[] } = {},
): { item: MenuItem; times: number } | null {
  const item = bestSellers(1, { kind: 'drink', items: opts.items })[0];
  if (!item) return null;
  const priceFils = Math.round(itemFromPrice(item) * 1000);
  if (!(priceFils > 0)) return null;
  const balanceFils = Math.round(jodFromPoints(points) * 1000);
  const times = Math.floor(balanceFils / priceFils);
  return times >= 1 ? { item, times } : null;
}
