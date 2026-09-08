import { ScrollView, StyleSheet, Pressable, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Gradient } from '@/components/ui/Gradient';
import { ComboOfferCard } from '@/components/home/ComboOfferCard';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';

interface Promo {
  id: string;
  emoji: string;
  /** A locale KEY, in both languages. The tiles used to carry `titleAr` /
   *  `titleEn` string literals, which is how three false claims lived on the
   *  offers page through a copy repair that scanned only the locale files. */
  titleKey: string;
  params?: Record<string, string | number>;
  onPress: () => void;
}

/**
 * DECISION: promotions are mock/static for MVP; in production these come from
 * the admin campaign engine (section 14.1).
 *
 * 🔴 WHAT CAME OFF THIS STRIP, AND WHY. Three tiles, all hardcoded bilingual
 * literals rather than locale keys — which is precisely why W4's locale sweep
 * could not see them and why they outlived the mechanics they promised:
 *
 *   - `combo` — «مشروب + طعام = 50 نقطة» / "Drink + food = 50 points". The
 *     number was a literal beside a config dial that has been 50 → 25 → 50, so
 *     it was wrong for the two days the dial sat at 25 (the same defect that
 *     shipped in the cart banner). PROMOTED, not deleted: it is the headline
 *     card above this strip now, and its count is interpolated from
 *     config.COMBO_BONUS_POINTS.
 *   - `friday` — "+50% points every Friday". DELETED. `WEEKDAY_EARN_BONUS` is
 *     `[]` and `BONUS_BEAN_DAY.enabled` is false, both retired 2026-09-06. This
 *     is the same promise W4 removed from the locale files as
 *     `tierBenefits.doubleDays4/6`; only the hardcoding saved it.
 *   - `wallet` — "Top up your wallet, earn +50% points". The claim was
 *     `WALLET_EARN_MULTIPLIER`, retired to 1.0 after ZERO rows in 171,291 live
 *     transactions, so it paid nothing. The RELOAD bonus is real
 *     (config.WALLET_RELOAD_BONUS, granted in bff/src/routes/wallet.ts), so the
 *     tile now says that instead, through `home.walletHint` — the same key and
 *     the same threshold the wallet card on this screen already uses.
 *
 * The `rewards` tile replaces the deleted Friday one with a claim that is
 * true at every rung and states no number at all, on keys that already ship.
 */
const promos: Promo[] = [
  {
    id: 'wallet',
    emoji: '👛',
    titleKey: 'home.walletHint',
    params: { min: config.WALLET_RELOAD_BONUS[0].minJOD },
    onPress: () => router.push('/profile/wallet'),
  },
  {
    id: 'rewards',
    emoji: '🎁',
    titleKey: 'rewards.headlineSub',
    onPress: () => router.push('/(tabs)/rewards'),
  },
];

export function PromoCarousel() {
  const { t } = useI18n();
  return (
    <View>
      <Text variant="title" style={styles.heading}>
        {t('home.promotions')}
      </Text>

      {/* The one offer in this section that changes what goes in a basket, so
          it is full width and first — see ComboOfferCard for the placement
          reasoning and for what it costs. */}
      <ComboOfferCard />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {promos.map((p) => (
          <Pressable key={p.id} style={styles.shadow} onPress={p.onPress} accessibilityRole="button">
            <Gradient preset="purple" style={styles.card}>
              <Text style={styles.emoji}>{p.emoji}</Text>
              <Text variant="bodyBold" color={colors.white}>
                {t(p.titleKey, p.params)}
              </Text>
            </Gradient>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: spacing.md },
  row: { gap: spacing.md, paddingEnd: spacing.lg },
  shadow: { borderRadius: radius.lg, ...shadow.card },
  card: {
    width: 240,
    height: 120,
    borderRadius: radius.lg,
    padding: spacing.lg,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  emoji: { fontSize: 32 },
});
