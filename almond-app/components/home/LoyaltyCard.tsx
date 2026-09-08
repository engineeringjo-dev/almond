import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Gradient } from '@/components/ui/Gradient';
import { TierBadge } from '@/components/loyalty/TierBadge';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatNumber } from '@/lib/format';
import { useLoyaltyBalance } from '@/hooks/useLoyalty';
import { tierProgressCopy } from '@/lib/tierCopy';

/** Home loyalty card: points + cup progress + tier badge (section 4.4 #4). */
export function LoyaltyCard() {
  const { t, lang } = useI18n();
  const { data, isLoading } = useLoyaltyBalance();

  return (
    <Pressable
      style={styles.shadow}
      onPress={() => router.push('/(tabs)/rewards')}
      accessibilityRole="button"
    >
      {/* Points hero uses the pastel rainbow gradient → dark text for contrast. */}
      <Gradient preset="rainbow" style={styles.card}>
        {isLoading || !data ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.dark} />
          </View>
        ) : (
          <>
            <View style={styles.left}>
              <Text variant="caption" color={colors.brown}>
                {t('home.loyaltyPoints')}
              </Text>
              <Text variant="display" color={colors.dark} style={styles.points}>
                {formatNumber(data.points, lang)}
              </Text>
              <TierBadge tier={data.tier} />
              {(() => {
                // Progress sense (§O), in VISITS and in one place — lib/tierCopy.ts.
                // This card used to gate its "one step away" line on
                // `remaining <= 30`, and the second rung's whole threshold is 20
                // JOD, so the gate was unconditionally true: EVERY member was
                // told "One step to tiers.plus ✨" from zero spend, with the
                // unresolved key rendered as literal text.
                const progress = tierProgressCopy(data, lang);
                if (!progress) return null;
                return (
                  <Text variant="caption" color={colors.brown}>
                    {t(progress.key, progress.params)}
                  </Text>
                );
              })()}
            </View>
          </>
        )}
      </Gradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: { borderRadius: radius.xl, ...shadow.raised },
  card: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 168,
    overflow: 'hidden',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 100 },
  /**
   * 🔴 `flex: 1` — THE MISSING LINE, AND THE WHOLE BUG.
   *
   * This column holds the tier progress sentence. The longest of the four
   * (`loyalty.toTop` — "About 5 more visits and your rate becomes 6% — our top
   * tier") ran off the right edge and was cut mid-word by the card's
   * `overflow: 'hidden'`. Reported from the live Pages build, 2026-09-08.
   *
   * The column had NO flex at all, so inside a `flexDirection: 'row'` card it
   * sized to its widest child and overflowed instead of wrapping. Every other
   * card on this screen already gets this right — GiftCardHome, PromotionBanner,
   * UsualOrderCard, VisitRewardBanner, WelcomeOffer and the profile header all
   * put `flex: 1` on their text column. This one card did not, which is why the
   * defect was here and nowhere else.
   *
   * `minWidth: 0` is DEFENSIVE, not the fix — do not read it as the reason this
   * works. `flex: 1` means `flex: 1 1 0%`, and against a basis of 0 the CSS
   * default `min-width: auto` only bites when min-content is wider than the
   * space available; for prose min-content is one word, so wrapping happens
   * regardless. It is kept because this app also ships to the web through
   * react-native-web (`expo export --platform web`), where that default is real
   * and an unbreakable token — a long URL, a pasted code — would otherwise
   * push the column wide again.
   */
  left: { flex: 1, minWidth: 0, gap: spacing.sm },
  points: { lineHeight: 42 },
});
