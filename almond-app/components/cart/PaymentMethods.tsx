import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { paymentMethods } from '@/services/seed';
import type { PaymentMethodId } from '@/types';

interface Props {
  value: PaymentMethodId;
  onChange: (m: PaymentMethodId) => void;
  walletBalance?: number;
  /** Loyalty points balance + points needed for the invoice (§K). */
  pointsBalance?: number;
  pointsNeeded?: number;
}

export function PaymentMethods({
  value,
  onChange,
  walletBalance,
  pointsBalance,
  pointsNeeded,
}: Props) {
  const { t, lang } = useI18n();
  const insufficientPoints =
    pointsBalance != null && pointsNeeded != null && pointsBalance < pointsNeeded;

  return (
    <View style={styles.wrap}>
      {paymentMethods.map((m) => {
        const active = m.id === value;
        const isPoints = m.id === 'points';
        const pointsDisabled = isPoints && insufficientPoints;
        return (
          <Pressable
            key={m.id}
            style={[styles.row, active && styles.rowActive, pointsDisabled && styles.disabled]}
            onPress={() => !pointsDisabled && onChange(m.id)}
            disabled={pointsDisabled}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled: pointsDisabled }}
          >
            <Text style={styles.emoji}>{m.emoji}</Text>
            <View style={styles.body}>
              <Text variant="bodyBold">{lang === 'ar' ? m.nameAr : m.nameEn}</Text>
              {m.id === 'wallet' && walletBalance != null ? (
                <Text variant="caption" color={colors.warmGray}>
                  {formatJOD(walletBalance, lang)}
                </Text>
              ) : null}
              {isPoints && pointsBalance != null ? (
                <Text variant="caption" color={pointsDisabled ? colors.red : colors.warmGray}>
                  {t('cart.pointsBalance', { points: pointsBalance })}
                  {pointsDisabled ? ` · ${t('cart.pointsInsufficient')}` : ''}
                </Text>
              ) : null}
              {/* When points selected, make the cost explicit (§K). */}
              {isPoints && active && pointsNeeded != null && !pointsDisabled ? (
                <Text variant="caption" color={colors.green}>
                  {t('cart.pointsUse', { points: pointsNeeded })}
                </Text>
              ) : null}
            </View>
            <View style={[styles.radio, active && styles.radioActive]}>
              {active ? <View style={styles.dot} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  rowActive: { borderColor: colors.gold },
  disabled: { opacity: 0.5 },
  emoji: { fontSize: 22 },
  body: { flex: 1 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.warmGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.gold },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.gold },
});
