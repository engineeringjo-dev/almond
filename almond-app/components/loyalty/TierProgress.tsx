import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { tiers, nextTier as findNextTier } from '@/services/seed';
import type { TierId } from '@/types';

interface Props {
  tier: TierId;
  lifetimeSpend: number;
}

/** Tier progress bar toward the next tier (section 4.9). */
export function TierProgress({ tier, lifetimeSpend }: Props) {
  const { t } = useI18n();
  const current = tiers.find((x) => x.id === tier) ?? tiers[0];
  const next = findNextTier(lifetimeSpend);

  const remaining = next ? Math.max(0, next.threshold - lifetimeSpend) : 0;
  const span = next ? next.threshold - current.threshold : 1;
  const pct = next ? Math.min(1, (lifetimeSpend - current.threshold) / span) : 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.labels}>
        {tiers.map((tr) => (
          <Text
            key={tr.id}
            variant="caption"
            color={tr.id === tier ? colors.gold : colors.warmGray}
            style={tr.id === tier ? styles.activeLabel : undefined}
          >
            {t(`tiers.${tr.id}`)}
          </Text>
        ))}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
      <Text variant="caption" color={colors.warmGray} style={styles.hint}>
        {next
          ? t('loyalty.tierProgress', {
              remaining: remaining.toFixed(0),
              nextTier: t(`tiers.${next.id}`),
            })
          : t('loyalty.tierMax')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  activeLabel: { fontWeight: '700' },
  track: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.gold, borderRadius: radius.pill },
  hint: { textAlign: 'center', marginTop: spacing.xs },
});
