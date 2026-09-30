import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { paymentIcon } from '@/lib/paymentIcon';
import { choiceA11y, choiceGroupA11y } from '@/lib/a11y';
import { paymentMethods } from '@/services/seed';
import type { PaymentMethodId } from '@/types';

interface Props {
  value: PaymentMethodId;
  onChange: (m: PaymentMethodId) => void;
  walletBalance?: number;
  total?: number;
}

export function PaymentMethods({ value, onChange, walletBalance, total }: Props) {
  const { t, lang } = useI18n();

  return (
    <View style={styles.wrap} {...choiceGroupA11y(false, t('cart.paymentMethod'))}>
      {paymentMethods.map((m) => {
        const active = m.id === value;
        // Wallet can't cover the order → disable it (no silent failure at pay).
        const disabled =
          m.id === 'wallet' && walletBalance != null && total != null && walletBalance < total;
        const name = lang === 'ar' ? m.nameAr : m.nameEn;
        const detail =
          m.id === 'wallet' && walletBalance != null
            ? disabled
              ? `${formatJOD(walletBalance, lang)} · ${t('cart.walletShort')}`
              : formatJOD(walletBalance, lang)
            : null;
        return (
          <Pressable
            key={m.id}
            style={[styles.row, active && styles.rowActive, disabled && styles.disabled]}
            onPress={() => !disabled && onChange(m.id)}
            disabled={disabled}
            // `checked`, not `selected`: a radio without it is announced as six
            // unchecked radios (axe aria-required-attr on the cart).
            {...choiceA11y('radio', active, detail ? `${name}، ${detail}` : name)}
            aria-disabled={disabled}
          >
            <View style={styles.iconWrap}>
              <Icon name={paymentIcon(m.id)} size={20} color={colors.primary} strokeWidth={1.9} />
            </View>
            <View style={styles.body}>
              <Text variant="bodyBold">{name}</Text>
              {detail ? (
                <Text variant="caption" color={disabled ? colors.red : colors.warmGray}>
                  {detail}
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
  iconWrap: {
    width: 38, height: 38, borderRadius: radius.sm,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center', justifyContent: 'center',
  },
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
