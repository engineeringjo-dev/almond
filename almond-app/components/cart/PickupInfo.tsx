import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Gradient } from '@/components/ui/Gradient';
import { Icon } from '@/components/ui/Icon';
import { colors, radius, spacing, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import type { Branch } from '@/types';
import type { PickupEstimate } from '@/lib/pickup';

interface Props {
  branch?: Branch;
  estimate: PickupEstimate;
  onChangeBranch: () => void;
}

/** Smart-pickup branch + ready-time estimate — purple gradient hero (matches design). */
export function PickupInfo({ branch, estimate, onChangeBranch }: Props) {
  const { t, lang } = useI18n();
  return (
    <View style={styles.shadow}>
      <Gradient preset="purple" style={styles.card}>
        <View style={styles.branchRow}>
          <View style={styles.left}>
            <Text variant="caption" color={colors.white}>
              {t('cart.branch')}
            </Text>
            <View style={styles.branchName}>
              <Icon name="map-pin" size={16} color={colors.white} />
              <Text variant="bodyBold" color={colors.white}>
                {branch ? (lang === 'ar' ? branch.nameAr : branch.nameEn) : '—'}
              </Text>
            </View>
          </View>
          <Pressable onPress={onChangeBranch} hitSlop={8} style={styles.changeBtn}>
            <Text variant="caption" color="#000000">
              {t('cart.change')}
            </Text>
          </Pressable>
        </View>

        <View style={styles.estimate}>
          <Text style={styles.sparkle}>{estimate.readyOnArrival ? '✨' : '⏱️'}</Text>
          <Text variant="bodyBold" color="#000000" style={styles.estimateText}>
            {estimate.readyOnArrival
              ? t('cart.readyOnArrival')
              : t('cart.readyIn', { min: estimate.prepMinutes })}
          </Text>
        </View>
      </Gradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { borderRadius: radius.lg, ...shadow.card },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden',
  },
  branchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  left: { gap: 2 },
  branchName: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  changeBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  estimate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  sparkle: { fontSize: 20 },
  estimateText: { flex: 1 },
});
