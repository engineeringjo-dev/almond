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
}

export function PaymentMethods({ value, onChange, walletBalance }: Props) {
  const { lang } = useI18n();

  return (
    <View style={styles.wrap}>
      {paymentMethods.map((m) => {
        const active = m.id === value;
        return (
          <Pressable
            key={m.id}
            style={[styles.row, active && styles.rowActive]}
            onPress={() => onChange(m.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text style={styles.emoji}>{m.emoji}</Text>
            <View style={styles.body}>
              <Text variant="bodyBold">{lang === 'ar' ? m.nameAr : m.nameEn}</Text>
              {m.id === 'wallet' && walletBalance != null ? (
                <Text variant="caption" color={colors.warmGray}>
                  {formatJOD(walletBalance, lang)}
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
