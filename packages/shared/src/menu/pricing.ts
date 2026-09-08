import type { MenuItem } from '../types';

/**
 * THE "FROM" PRICE ON A MENU CARD — the least a member can actually pay.
 *
 * 🔴 IT IS NOT `min(sizes)`, AND THAT IS THE WHOLE REASON THIS FILE EXISTS.
 *
 * The Talabat export models some items as a ZERO base price plus a mandatory
 * single-choice group carrying the real money: every full cake is `0.000` with
 * a "Your choice" group offering Medium 16.000 / Large 20.000, and all ten
 * pizzas are the same shape. Thirty items in the shipped menu are built this
 * way. Six call sites across the app and the website each computed
 * `Math.min(...sizes.map(s => s.price))` independently, so every one of them
 * advertised «من ٠٫٠٠٠ د.أ» for a sixteen-dinar cake.
 *
 * Nothing was ever SOLD at zero — ItemConfigurator pre-selects the first option
 * of a single-choice group, so opening the item immediately shows 16.000, and
 * the cheapest option of every one of those thirty groups is greater than zero.
 * The defect was a price advertised on the grid that no member could ever pay.
 *
 * A single-choice group (`multiple: false`) is MANDATORY in effect: the
 * configurator pre-selects one and there is no "none" option, so its cheapest
 * option is part of the floor. A multi-choice group is genuinely optional —
 * extras, add-ons — and must NOT be added, or the card would overquote.
 *
 * One function, one answer, both surfaces.
 */
export function itemFromPrice(item: MenuItem): number {
  const base = item.sizes.length
    ? item.sizes.reduce((min, s) => Math.min(min, s.price), Infinity)
    : 0;

  const mandatory = (item.customizations ?? [])
    .filter((g) => !g.multiple && g.options.length > 0)
    .reduce(
      (sum, g) => sum + g.options.reduce((m, o) => Math.min(m, o.priceDelta), Infinity),
      0,
    );

  return base + mandatory;
}
