import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Gradient } from '@/components/ui/Gradient';
import { Cup } from '@/components/loyalty/Cup';
import { TierBadge } from '@/components/loyalty/TierBadge';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatNumber } from '@/lib/format';
import { useLoyaltyBalance } from '@/hooks/useLoyalty';
import { nextTier } from '@/services/seed';

/** Home loyalty card: points + cup progress + tier badge (section 4.4 #4). */
export function LoyaltyCard() {
  const { t, lang } = useI18n();
  const { data, isLoading } = useLoyaltyBalance();

  return (
    <Pressable
      style={styles.shadow}
      onPress={() => router.push('/loyalty')}
      accessibilityRole="button"
    >
      <Gradient preset="dark" style={styles.card}>
        {isLoading || !data ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ) : (
          <>
            <View style={styles.left}>
              <Text variant="caption" color={colors.lightGold}>
                {t('home.loyaltyPoints')}
              </Text>
              <Text variant="display" color={colors.cream} style={styles.points}>
                {formatNumber(data.points, lang)}
              </Text>
              <TierBadge tier={data.tier} />
              {(() => {
                // Progress sense (§O): how much left to the next tier.
                const next = nextTier(data.windowSpend);
                if (!next) return null;
                const remaining = Math.max(0, next.threshold - data.windowSpend);
                return (
                  <Text variant="caption" color={colors.lightGold}>
                    {t('home.toNextTier', {
                      remaining: remaining.toFixed(0),
                      tier: t(`tiers.${next.id}`),
                    })}
                  </Text>
                );
              })()}
            </View>
            <View style={styles.right}>
              <Cup current={data.cup.current} target={data.cup.target} size={80} />
              <Text variant="caption" color={colors.lightGold} style={styles.cupLabel}>
                {t('loyalty.cupProgress', {
                  current: Math.floor(data.cup.current),
                  target: data.cup.target,
                })}
              </Text>
            </View>
          </>
        )}
      </Gradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: { borderRadius: radius.lg, ...shadow.raised },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 132,
    overflow: 'hidden',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 100 },
  left: { gap: spacing.sm },
  points: { lineHeight: 42 },
  right: { alignItems: 'center', gap: spacing.xs },
  cupLabel: { marginTop: spacing.xs },
});
