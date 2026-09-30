import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { colors, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { tabA11y } from '@/lib/a11y';
import type { OrderType } from '@/types';

interface Props {
  value: OrderType;
  onChange: (t: OrderType) => void;
}

// Line icons from the app's one set (the emoji 🏃☕🛵 differed per OS, took
// no tint and were read aloud as "person running").
const tabs: { id: OrderType; key: string; icon: IconName }[] = [
  { id: 'pickup', key: 'cart.pickup', icon: 'pickup' },
  { id: 'dinein', key: 'cart.dinein', icon: 'coffee' },
  { id: 'delivery', key: 'cart.delivery', icon: 'delivery' },
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
            <Icon
              name={tab.icon}
              size={20}
              color={active ? colors.dark : colors.warmGray}
              strokeWidth={active ? 2.2 : 1.8}
            />
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
    justifyContent: 'center',
    minHeight: 56,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    gap: 2,
  },
  tabActive: { backgroundColor: colors.lightGold },
});
