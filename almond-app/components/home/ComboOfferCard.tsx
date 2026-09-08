import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Gradient } from '@/components/ui/Gradient';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
import { comboOfferCopy } from '@/lib/comboOffer';
import { getComboStarter } from '@almond/shared/lib/recommendations';
import { useCartStore } from '@/stores/cartStore';

/**
 * THE COMBO, ON THE OFFERS PAGE.
 *
 * ── WHERE IT SITS, AND WHAT MOVED ───────────────────────────────────────────
 *
 * It is the HEADLINE of the Offers section (`home.promotions` = "Offers" /
 * «العروض»), full width, above the horizontal promo strip — because it is the
 * only offer in that section that changes what a member puts in a basket, and
 * because the strip is where it was invisible. Two things moved to make room:
 *
 *   - The old `combo` tile came OUT of the strip. It said «مشروب + طعام = 50
 *     نقطة» / "Drink + food = 50 points" as a hardcoded bilingual literal, so it
 *     was both the second copy of a config number (the exact drift that shipped
 *     in the cart banner when the dial went to 25) and invisible to the locale
 *     scan that would otherwise have caught it. Its content is this card now.
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
 * states the offer ("any drink + any food"), states the price honestly (full
 * price for both — `config.BRUNCH_COMBO_DISCOUNT` is 0 and the points are the
 * entire offer), and names one concrete pair as an EXAMPLE, not as a
 * restriction. The count comes from the dial through `comboOfferCopy`; there is
 * no literal in this file, in the locale values, or in either language.
 */
export function ComboOfferCard() {
  const { t, lang } = useI18n();
  const addItem = useCartStore((s) => s.addItem);

  // earn-arith-exempt: an offer LABEL — no invoice, no grant. §3.5 / §7 T7.
  const points = config.COMBO_BONUS_POINTS;
  const copy = comboOfferCopy(points, STARTER, lang);
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
    router.push('/(tabs)/cart');
  };

  return (
    <Pressable style={styles.shadow} onPress={onPress} accessibilityRole="button">
      <Gradient preset="purple" style={styles.card}>
        <Text style={styles.emoji}>🍽️</Text>
        <Text variant="bodyBold" color={colors.white}>
          {t(copy.titleKey, copy.params)}
        </Text>
        <Text variant="caption" color={colors.white} style={styles.body}>
          {t(copy.bodyKey, copy.params)}
        </Text>
        <View style={styles.footer}>
          {copy.example ? (
            <Text variant="caption" color={colors.white} style={styles.example} numberOfLines={2}>
              {t(copy.example.key, copy.example.params)}
            </Text>
          ) : (
            <View style={styles.example} />
          )}
          <View style={styles.cta}>
            <Text variant="caption" color={colors.dark} style={styles.ctaLabel}>
              {t('offers.comboCta')}
            </Text>
          </View>
        </View>
      </Gradient>
    </Pressable>
  );
}

/**
 * Computed once at module load, not per render. `getComboStarter()` walks the
 * 267-item static seed; the menu cannot change inside a session, so a `useMemo`
 * would only re-run it on every mount for the same answer.
 */
const STARTER = getComboStarter();

const styles = StyleSheet.create({
  shadow: { borderRadius: radius.lg, marginBottom: spacing.md, ...shadow.card },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    overflow: 'hidden',
  },
  emoji: { fontSize: 28 },
  body: { opacity: 0.92 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  example: { flex: 1 },
  cta: {
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  ctaLabel: { fontWeight: '700' },
});
