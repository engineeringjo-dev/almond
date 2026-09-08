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
            {/* The cup renders only where a producer actually keeps one. It was
                `data.cup.current` unguarded, and the BFF — the only real
                producer — never sends the field: fed the real wire body this
                line THREW and took the entire card down with it, not just the
                cup. `cup` is optional on LoyaltyBalance for that reason. */}
            {data.cup ? (
              <View style={styles.right}>
                <Cup current={data.cup.current} target={data.cup.target} size={96} />
                <Text variant="caption" color={colors.brown} center style={styles.cupLabel}>
                  {data.cup.target - data.cup.current <= 3 && data.cup.current < data.cup.target
                    ? t('loyalty.cupClose')
                    : t('loyalty.cupProgress', {
                        current: Math.floor(data.cup.current),
                        target: data.cup.target,
                      })}
                </Text>
              </View>
            ) : null}
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
  left: { gap: spacing.sm },
  points: { lineHeight: 42 },
  right: { alignItems: 'center', gap: spacing.xs },
  cupLabel: { marginTop: spacing.xs },
});
