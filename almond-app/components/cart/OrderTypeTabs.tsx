import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import type { OrderType } from '@/types';

interface Props {
  value: OrderType;
  onChange: (t: OrderType) => void;
}

const tabs: { id: OrderType; key: string; emoji: string }[] = [
  { id: 'pickup', key: 'cart.pickup', emoji: '🏃' },
  { id: 'dinein', key: 'cart.dinein', emoji: '☕' },
  { id: 'delivery', key: 'cart.delivery', emoji: '🛵' },
];

export function OrderTypeTabs({ value, onChange }: Props) {
  const { t } = useI18n();
  return (
    <View style={styles.row}>
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <Pressable
            key={tab.id}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={styles.emoji}>{tab.emoji}</Text>
            <Text variant="caption" color={active ? colors.dark : colors.warmGray}>
              {t(tab.key)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    gap: 2,
  },
  tabActive: { backgroundColor: colors.lightGold },
  emoji: { fontSize: 20 },
});
