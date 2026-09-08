import type { ComboStarter } from '@almond/shared/lib/recommendations';
import type { Lang } from '@/types';

/**
 * THE COMBO OFFER, STATED COLD.
 *
 * «أي مشروب + أي طعام = N نقطة» — the drink+food bonus, said to a member who
 * has not started an order.
 *
 * ── WHY THIS MODULE EXISTS AT ALL ───────────────────────────────────────────
 *
 * Until now the combo appeared in exactly one place: the banner inside
 * `components/cart/CrossSellRow.tsx`, which renders only when the basket
 * already holds one half of the pair (`getComboUpsell` returns null on an empty
 * cart). So the offer was visible only to a member who had already, by
 * accident, half-earned it — and the owner went looking for it on the offers
 * page and could not find it (2026-09-06). That is the whole reason for this
 * package.
 *
 * The cart banner may lean on basket context; this cannot. Every sentence here
 * has to make sense to someone standing at the top of Home with nothing
 * selected, so the copy states the OFFER ("any drink + any food") rather than
 * an instruction about a basket ("add food to your drink").
 *
 * ── WHY THE POINTS ARE A PARAMETER ──────────────────────────────────────────
 *
 * 🔴 THIS IS THE BUG THIS FILE EXISTS TO NOT REPEAT. The cart banner's label
 * read "50 points" as a hard literal while `config.COMBO_BONUS_POINTS` was 25 —
 * two days of the app promising twice what the server granted, in both
 * languages, with 222 tests green. The offers-page tile in PromoCarousel.tsx
 * carried the same literal in a hardcoded bilingual string, where even the
 * locale-file scan (C4) could not see it.
 *
 * So: the count arrives as an argument, the locale values interpolate
 * `{{points}}` and contain no digit at all, and C14 in bff/test/copy.test.ts
 * enforces both halves structurally. `comboOfferCopy(25, …)` and
 * `comboOfferCopy(50, …)` differ, and the tests say so — which is the assertion
 * that would have caught the original drift.
 *
 * ── WHY A DIAL OF ZERO REMOVES THE CARD ─────────────────────────────────────
 *
 * The points ARE the offer: `config.BRUNCH_COMBO_DISCOUNT` has been 0 since
 * 2026-09-04 and the member pays the full price of both halves. At
 * COMBO_BONUS_POINTS = 0 there is therefore nothing being offered, and a card
 * saying "= 0 points" is worse than no card. The dial does not merely fill in a
 * number in this sentence; it decides whether the sentence may be said.
 */

export interface ComboOfferCopy {
  /** Headline. `{{points}}` — never a literal. */
  titleKey: 'offers.comboTitle';
  /** The plain statement: full price for both, the points are the whole offer. */
  bodyKey: 'offers.comboBody';
  params: { points: number };
  /**
   * One concrete pair, named. Null when the shipped menu cannot produce one —
   * then the card still explains the offer and simply sends the member to the
   * menu, rather than disappearing over a data problem.
   */
  example: { key: 'offers.comboExample'; params: { drink: string; food: string } } | null;
}

export function comboOfferCopy(
  points: number,
  starter: ComboStarter | null,
  lang: Lang,
): ComboOfferCopy | null {
  // A non-integer or non-positive dial is not an offer. `Number.isFinite`
  // because the value is read off config and a NaN would otherwise render as
  // "NaN points" inside a headline.
  if (!Number.isFinite(points) || points < 1) return null;

  const example = starter
    ? {
        key: 'offers.comboExample' as const,
        params: {
          drink: lang === 'ar' ? starter.drink.nameAr : starter.drink.nameEn,
          food: lang === 'ar' ? starter.food.nameAr : starter.food.nameEn,
        },
      }
    : null;

  return {
    titleKey: 'offers.comboTitle',
    bodyKey: 'offers.comboBody',
    params: { points },
    example,
  };
}
