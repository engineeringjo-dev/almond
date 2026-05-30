import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from './Text';
import { colors, radius, spacing } from '@/constants/theme';

interface Props {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}

export function Stepper({ value, onChange, min = 1, max = 99 }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.btn, value <= min && styles.disabled]}
        onPress={() => value > min && onChange(value - 1)}
        disabled={value <= min}
        hitSlop={6}
        accessibilityLabel="decrease"
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
        accessibilityLabel="increase"
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
  btn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.lightGold,
  },
  disabled: { opacity: 0.4 },
  value: { minWidth: 24, textAlign: 'center' },
});
