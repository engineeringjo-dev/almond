import { StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { PhotoTile } from '@/components/home/PhotoTile';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
import { comboOfferCopy } from '@/lib/comboOffer';
import { getComboStarter } from '@almond/shared/lib/recommendations';
import { useCartStore } from '@/stores/cartStore';
import type { Lang } from '@/types';

/**
 * THE COMBO, THE FIRST SLIDE OF HOME'S OFFERS CAROUSEL.
 *
 * ── WHERE IT SITS, AND WHAT MOVED ───────────────────────────────────────────
 *
 * It leads the offers carousel (PromoCarousel, «العروض»): it is the only offer
 * there that changes what a member puts in a basket. It was the full-width
 * headline above a strip of tiles; Home is now four blocks (expert panel,
 * 2026-10-15) and the offers are one carousel, so it is the first slide, with
 * a photograph of the pair it adds. Two things moved before that, and stay
 * moved:
 *
 *   - The old `combo` tile came OUT of the strip. It said «مشروب + طعام = 50
 *     نقطة» / "Drink + food = 50 points" as a hardcoded bilingual literal, so it
 *     was both the second copy of a config number (the exact drift that shipped
 *     in the cart banner when the dial went to 25) and invisible to the locale
 *     scan that would otherwise have caught it.
 *   - The `friday` tile — "+50% points every Friday" — was DELETED. That
 *     mechanic is retired: `config.WEEKDAY_EARN_BONUS` is `[]` and
 *     `BONUS_BEAN_DAY.enabled` is false. It is the same promise W4 deleted from
 *     the locale files as `doubleDays4/doubleDays6`; it survived only because
 *     it was hardcoded in a .tsx and no locale test can see a .tsx.
 *
 * ── WHAT TAPPING IT DOES, AND WHY NOT THE OTHER TWO OPTIONS ─────────────────
 *
 * It adds a real pair to the cart and takes the member to the cart.
 *
 * NOT a menu filter: 251 of the 267 shipped items (94.0%) already classify
 * `drink` or `food`, so a "combo-eligible" filter removes 16 items and returns
 * the menu unchanged. And the offer is two-sided — a filtered list shows one
 * half of a pair at a time and never says which two go together.
 *
 * NOT an explainer alone: the member is on Home with an empty basket, and the
 * card's job is to raise the share of invoices that contain a pair. An
 * explainer ends on Home.
 *
 * The pairing itself is `getComboStarter()` in @almond/shared — the cold-start
 * sibling of the `getComboUpsell` this same offer already uses in the cart, so
 * the app has ONE pairing engine and not two that agree today. Landing in the
 * cart is also where the claim is checked: `comboPairs()` counts the pair,
 * `CrossSellRow`'s combo banner correctly stops nagging, and the totals are the
 * real ones.
 *
 * ── COLD COPY ───────────────────────────────────────────────────────────────
 *
 * Read by someone who has not started an order, so it assumes no basket: it
 * states the offer ("any drink + any food") and names one concrete pair as an
 * EXAMPLE, not as a restriction. The plain statement — full price for both,
 * `config.BRUNCH_COMBO_DISCOUNT` is 0 and the points are the entire offer —
 * does not fit on a slide; a screen reader reads it with the slide, and the
 * cart shows the real totals the moment the pair lands there. The count comes
 * from the dial through `comboOfferCopy`; there is no literal in this file, in
 * the locale values, or in either language.
 */
export function ComboOfferCard({ onFocus, press }: { onFocus?: () => void; press?: (fn: () => void) => () => void }) {
  const { t, lang } = useI18n();
  const addItem = useCartStore((s) => s.addItem);

  const copy = comboOffer(lang);
  if (!copy) return null;

  const onPress = () => {
    if (!STARTER) {
      // No suggestible pair (an empty or unpriced menu). The offer is still
      // real, so send them to the menu rather than nowhere.
      router.push('/(tabs)/order');
      return;
    }
    // The cheapest PRICED size of each half — the same size the reasoning
    // behind the suggestion priced (see getComboStarter). `sizes[0]` would
    // silently add a large.
    addItem(STARTER.drink, STARTER.drinkSize, [], 1);
    addItem(STARTER.food, STARTER.foodSize, [], 1);
    router.push('/cart');
  };

  return (
    <PhotoTile
      title={t(copy.titleKey, copy.params)}
      subtitle={copy.example ? t(copy.example.key, copy.example.params) : undefined}
      cta={t('offers.comboCta')}
      // The whole statement — full price for both, the points are the offer —
      // is read out with the slide; it does not fit on one.
      accessibilityHint={t(copy.bodyKey, copy.params)}
      photos={[STARTER?.drink.imageUrl, STARTER?.food.imageUrl]}
      icon="brunch"
      onPress={press ? press(onPress) : onPress}
      onFocus={onFocus}
      style={styles.fill}
    />
  );
}

/** The offer, or null when the dial is off: the carousel asks before it
 *  counts the slide, so an empty dial leaves no empty slide behind. */
export function comboOffer(lang: Lang) {
  // earn-arith-exempt: an offer LABEL — no invoice, no grant. §3.5 / §7 T7.
  const points = config.COMBO_BONUS_POINTS;
  return comboOfferCopy(points, STARTER, lang);
}

/**
 * Computed once at module load, not per render. `getComboStarter()` walks the
 * 267-item static seed; the menu cannot change inside a session, so a `useMemo`
 * would only re-run it on every mount for the same answer.
 */
const STARTER = getComboStarter();

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
