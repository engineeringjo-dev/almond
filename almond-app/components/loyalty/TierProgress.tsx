import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { tiers, nextTier as findNextTier } from '@/services/seed';
import type { TierId } from '@/types';

interface Props {
  tier: TierId;
  /** Rolling-12-month qualifying spend (Revision Pack §A). */
  windowSpend: number;
}

/**
 * Full tier ladder (Revision Pack §B): shows ALL four tiers as a multi-stop
 * progress bar so the user sees where they are and what's ahead. Stops are
 * evenly spaced for clarity; fill advances stop-by-stop with the in-segment
 * fraction. Each tier shows the remaining spend to the NEXT tier.
 */
export function TierProgress({ tier, windowSpend }: Props) {
  const { t } = useI18n();
  const currentIndex = Math.max(
    0,
    tiers.map((x) => x.id).lastIndexOf(tier),
  );
  const next = findNextTier(windowSpend);
  const lastIdx = tiers.length - 1;

  // Fraction within the current segment (0..1).
  const cur = tiers[currentIndex];
  const segFraction =
    next && next.threshold > cur.threshold
      ? Math.min(1, Math.max(0, (windowSpend - cur.threshold) / (next.threshold - cur.threshold)))
      : 1;
  const fillPct = ((currentIndex + (next ? segFraction : 0)) / lastIdx) * 100;
  const remaining = next ? Math.max(0, next.threshold - windowSpend) : 0;

  return (
    <View style={styles.wrap}>
      {/* multi-stop track */}
      <View style={styles.trackArea}>
        <View style={styles.track} />
        <View style={[styles.fill, { width: `${fillPct}%` }]} />
        <View style={styles.stopsRow}>
          {tiers.map((tr, i) => {
            const reached = windowSpend >= tr.threshold;
            const isCurrent = i === currentIndex;
            return (
              <View key={tr.id} style={styles.stopCol}>
                <View
                  style={[
                    styles.stop,
                    reached && { backgroundColor: tr.color, borderColor: tr.color },
                    isCurrent && styles.stopCurrent,
                  ]}
                >
                  <Text style={styles.stopMark}>{reached ? '☕' : ''}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* labels with thresholds */}
      <View style={styles.labels}>
        {tiers.map((tr) => (
          <View key={tr.id} style={styles.labelCol}>
            <Text
              variant="caption"
              color={tr.id === tier ? colors.gold : colors.warmGray}
              center
              style={tr.id === tier ? styles.activeLabel : undefined}
            >
              {t(`tiers.${tr.id}`)}
            </Text>
            <Text variant="caption" color={colors.warmGray} center style={styles.threshold}>
              {tr.threshold}
            </Text>
          </View>
        ))}
      </View>

      <Text variant="bodyBold" color={colors.dark} center style={styles.remaining}>
        {!next
          ? t('loyalty.tierMax')
          : remaining <= 30
            ? t('loyalty.tierClose', { tier: t(`tiers.${next.id}`) })
            : t('loyalty.tierProgress', {
                remaining: remaining.toFixed(0),
                nextTier: t(`tiers.${next.id}`),
              })}
      </Text>
      <Text variant="caption" color={colors.warmGray} center>
        {t('loyalty.windowNote')}
      </Text>
    </View>
  );
}

const STOP = 26;

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  trackArea: { height: STOP, justifyContent: 'center' },
  track: {
    position: 'absolute',
    start: STOP / 2,
    end: STOP / 2,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
  },
  fill: {
    position: 'absolute',
    start: STOP / 2,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    maxWidth: `${100}%`,
  },
  stopsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stopCol: { width: STOP, alignItems: 'center' },
  stop: {
    width: STOP,
    height: STOP,
    borderRadius: STOP / 2,
    backgroundColor: colors.cardBg,
    borderWidth: 2,
    borderColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopCurrent: { borderColor: colors.gold, borderWidth: 3 },
  stopMark: { fontSize: 11 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  labelCol: { width: 64, alignItems: 'center', marginHorizontal: -19 },
  activeLabel: { fontWeight: '700' },
  threshold: { opacity: 0.7 },
  remaining: { marginTop: spacing.sm },
});
