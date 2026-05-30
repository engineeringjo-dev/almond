import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Cup } from '@/components/loyalty/Cup';
import { TierBadge } from '@/components/loyalty/TierBadge';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatNumber } from '@/lib/format';
import { useLoyaltyBalance } from '@/hooks/useLoyalty';

/** Home loyalty card: points + cup progress + tier badge (section 4.4 #4). */
export function LoyaltyCard() {
  const { t, lang } = useI18n();
  const { data, isLoading } = useLoyaltyBalance();

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push('/loyalty')}
      accessibilityRole="button"
    >
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.dark,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 132,
    ...shadow.raised,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 100 },
  left: { gap: spacing.sm },
  points: { lineHeight: 42 },
  right: { alignItems: 'center', gap: spacing.xs },
  cupLabel: { marginTop: spacing.xs },
});
