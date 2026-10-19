import { View, StyleSheet } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatNumber } from '@/lib/format';

/**
 * «عليك 40 نقطة من مشتريات مُسترَدة، نخصمها من نقاطك القادمة» — the points a
 * refund left owed because the points balance did not cover them.
 *
 * Review 2026-10-19, item 9: the debt was taken from the member's next gift or
 * transfer without ever being shown. The owner kept that recovery
 * (2026-10-19: «من كل النقاط القادمة»), so the member is told before it
 * happens. The count is the SERVER's (`LoyaltyBalance.pointsOwed`). Shown
 * BESIDE the balance, never taken off it: the balance is what can be spent.
 * Renders nothing at 0. The history says which refund and which deduction
 * (PointsHistory, loyalty/history.ts owedNote).
 */
export function PointsOwedNote({ points, color = colors.dark }: { points: number | undefined; color?: string }) {
  const { t, lang } = useI18n();
  if (!points || points <= 0) return null;
  const sentence = t('loyalty.pointsOwed', { count: points, points: formatNumber(points, lang) });
  return (
    <View style={styles.row} accessible accessibilityLabel={sentence}>
      <Icon name="receipt" size={18} color={color} strokeWidth={1.75} />
      <Text variant="caption" color={color} style={styles.text}>
        {sentence}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Stretched: the history page's summary centres its children, and a row
  // sized to its own content would squeeze the sentence to nothing.
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: spacing.xs },
  text: { flex: 1, minWidth: 0 },
});
