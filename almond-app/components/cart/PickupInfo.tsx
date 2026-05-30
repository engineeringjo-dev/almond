import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import type { Branch } from '@/types';
import type { PickupEstimate } from '@/lib/pickup';

interface Props {
  branch?: Branch;
  estimate: PickupEstimate;
  onChangeBranch: () => void;
}

/** Smart-pickup branch + ready-time estimate (sections 4.6, 7.3). */
export function PickupInfo({ branch, estimate, onChangeBranch }: Props) {
  const { t, lang } = useI18n();
  return (
    <View style={styles.card}>
      <View style={styles.branchRow}>
        <View style={styles.left}>
          <Text variant="caption" color={colors.warmGray}>
            {t('cart.branch')}
          </Text>
          <Text variant="bodyBold">
            📍 {branch ? (lang === 'ar' ? branch.nameAr : branch.nameEn) : '—'}
          </Text>
        </View>
        <Pressable onPress={onChangeBranch} hitSlop={8}>
          <Text variant="caption" color={colors.gold}>
            {t('cart.change')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.estimate}>
        <Text style={styles.sparkle}>{estimate.readyOnArrival ? '✨' : '⏱️'}</Text>
        <Text variant="bodyBold" color={colors.dark} style={styles.estimateText}>
          {estimate.readyOnArrival
            ? t('cart.readyOnArrival')
            : t('cart.readyIn', { min: estimate.prepMinutes })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  branchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  left: { gap: 2 },
  estimate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.lightGold,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  sparkle: { fontSize: 20 },
  estimateText: { flex: 1 },
});
