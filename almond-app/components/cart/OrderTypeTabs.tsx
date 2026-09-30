import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { tabA11y } from '@/lib/a11y';
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
    // A tablist, so each tab is announced in its set ("tab, 2 of 3") — a lone
    // role="tab" outside one fails axe aria-required-parent.
    <View style={styles.row} role="tablist">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <Pressable
            key={tab.id}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(tab.id)}
            {...tabA11y(active, t(tab.key))}
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
