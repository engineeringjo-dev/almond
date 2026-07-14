import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD, formatNumber } from '@/lib/format';
import type { CartTotals } from '@/stores/cartStore';

export function Summary({ totals, pointsToEarn }: { totals: CartTotals; pointsToEarn?: number }) {
  const { t, lang } = useI18n();
  return (
    <View style={styles.wrap}>
      <Row label={t('cart.subtotal')} value={formatJOD(totals.subtotal, lang)} />
      {totals.discount > 0 ? (
        <Row
          label={t('cart.discount')}
          value={`− ${formatJOD(totals.discount, lang)}`}
          color={colors.green}
        />
      ) : null}
      <Row label={t('cart.tax')} value={formatJOD(totals.tax, lang)} />
      <View style={styles.divider} />
      <Row label={t('cart.total')} value={formatJOD(totals.total, lang)} bold />

      {/* Loyalty value made visible at the moment of payment. */}
      {pointsToEarn && pointsToEarn > 0 ? (
        <View style={styles.earn}>
          <Icon name="bean" size={16} color={colors.primary} strokeWidth={2} />
          <Text variant="bodyBold" color={colors.primary}>
            {t('cart.earnEstimate', { points: formatNumber(pointsToEarn, lang) })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Row({
  label,
  value,
  bold,
  color,
}: {
  label: string;
  value: string;
  bold?: boolean;
  color?: string;
}) {
  return (
    <View style={styles.row}>
      <Text variant={bold ? 'title' : 'body'} color={color}>
        {label}
      </Text>
      <Text variant={bold ? 'h2' : 'bodyBold'} color={bold ? colors.gold : color}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: 1, backgroundColor: colors.cardBg, marginVertical: spacing.xs },
  earn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.neutralWarm,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
});
