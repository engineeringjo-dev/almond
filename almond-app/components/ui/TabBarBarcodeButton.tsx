import { Pressable, StyleSheet, View, GestureResponderEvent } from 'react-native';
import { Icon } from './Icon';
import { Text } from './Text';
import { colors, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';

interface Props {
  focused: boolean;
  onPress?: (e: GestureResponderEvent) => void;
}

/**
 * Raised, FAB-style center tab for the personal barcode (Order Spec §1). It sits
 * elevated above the bar in the brand colour so "scan to pay & earn" is always
 * the most reachable action — Starbucks' centre-scan pattern.
 */
export function TabBarBarcodeButton({ focused, onPress }: Props) {
  const { t } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel={t('tabs.barcode')}
      accessibilityState={{ selected: focused }}
    >
      <View style={[styles.fab, focused && styles.fabFocused]}>
        <Icon name="qr" size={26} color={colors.white} strokeWidth={2.2} />
      </View>
      <Text variant="caption" color={focused ? colors.primary : colors.warmGray} style={styles.label}>
        {t('tabs.barcode')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    borderWidth: 4,
    borderColor: colors.cardBg,
    ...shadow.raised,
  },
  fabFocused: { backgroundColor: colors.dark },
  label: { fontSize: 10, lineHeight: 15, marginTop: 2 },
});
