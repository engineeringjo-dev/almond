import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { tiers } from '@/services/seed';
import { tierName } from '@almond/shared/loyalty';
import { tierProgressCopy } from '@/lib/tierCopy';
import type { LoyaltyBalance, TierId } from '@/types';

interface Props {
  tier: TierId;
  /** Qualifying spend inside the 90-day window (config.TIER_WINDOW_DAYS). */
  windowSpend: number;
  /** `standing().next` when the caller has it — see lib/tierCopy.ts. Without
   *  it the bottom line falls back to the spend-only projection. */
  nextTier?: LoyaltyBalance['nextTier'];
}

/**
 * The full tier ladder (Revision Pack §B) as a multi-stop progress bar, so the
 * member sees where they are and what is ahead. Stops are evenly spaced; the
 * fill advances stop-by-stop with the in-segment fraction.
 *
 * The bare threshold row under each label ("0 / 20 / 65") is GONE. It was three
 * unitless integers — not dinars, not visits, not points, and unlabelled in
 * either language — sitting directly under the tier names, and the copy rules
 * forbid stating the ladder in dinars at all. What is left is the name (the
 * rate) and one sentence in visits.
 */
export function TierProgress({ tier, windowSpend, nextTier }: Props) {
  const { t, lang } = useI18n();
  const currentIndex = Math.max(
    0,
    tiers.map((x) => x.id).lastIndexOf(tier),
  );
  // The rung ABOVE the one held, not above the spend: since W1 the 90-day
  // window can roll off while the rate cannot (there is no demotion), so
  // deriving this from windowSpend would point a rolled-off member back at a
  // rung they already passed.
  const next = tiers[currentIndex + 1] ?? null;
  const lastIdx = tiers.length - 1;

  // Fraction within the current segment (0..1).
  const cur = tiers[currentIndex];
  const segFraction =
    next && next.threshold > cur.threshold
      ? Math.min(1, Math.max(0, (windowSpend - cur.threshold) / (next.threshold - cur.threshold)))
      : 1;
  const fillPct = ((currentIndex + (next ? segFraction : 0)) / lastIdx) * 100;
  const progress = tierProgressCopy({ tier, windowSpend, nextTier }, lang);

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

      {/* labels — the rate itself, from the tier data */}
      <View style={styles.labels}>
        {tiers.map((tr) => (
          <View key={tr.id} style={styles.labelCol}>
            <Text
              variant="caption"
              color={tr.id === tier ? colors.gold : colors.warmGray}
              center
              style={tr.id === tier ? styles.activeLabel : undefined}
            >
              {tierName(tr, lang)}
            </Text>
          </View>
        ))}
      </View>

      <Text variant="bodyBold" color={colors.dark} center style={styles.remaining}>
        {progress
          ? t(progress.key, progress.params)
          : t('loyalty.tierMax', { tier: tierName(tiers[lastIdx], lang) })}
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
    backgroundColor: colors.neutralWarm,
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
    borderColor: colors.neutralWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopCurrent: { borderColor: colors.gold, borderWidth: 3 },
  stopMark: { fontSize: 11 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  labelCol: { width: 64, alignItems: 'center', marginHorizontal: -19 },
  activeLabel: { fontWeight: '700' },
  remaining: { marginTop: spacing.sm },
});
