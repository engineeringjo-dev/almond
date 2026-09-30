import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from './Text';
import { colors, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { MIN_TOUCH_TARGET } from '@/lib/a11y';

interface Props {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  /** What is being counted (an item name), so each button says whose quantity it changes. */
  label?: string;
}

export function Stepper({ value, onChange, min = 1, max = 99, label }: Props) {
  const { t } = useI18n();
  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.btn, value <= min && styles.disabled]}
        onPress={() => value > min && onChange(value - 1)}
        disabled={value <= min}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={label ? t('cart.decreaseQty', { name: label }) : t('common.decrease')}
      >
        <Text variant="h2" color={colors.dark}>
          −
        </Text>
      </Pressable>
      <Text variant="bodyBold" style={styles.value}>
        {value}
      </Text>
      <Pressable
        style={[styles.btn, value >= max && styles.disabled]}
        onPress={() => value < max && onChange(value + 1)}
        disabled={value >= max}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={label ? t('cart.increaseQty', { name: label }) : t('common.increase')}
      >
        <Text variant="h2" color={colors.dark}>
          +
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // 44 pt / 48 dp on every platform: hitSlop is ignored on the web.
  btn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radius.sm,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.lightGold,
  },
  disabled: { opacity: 0.4 },
  value: { minWidth: 24, textAlign: 'center' },
});
