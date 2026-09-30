import { Pressable, StyleSheet, View, GestureResponderEvent, type Role } from 'react-native';
import { Icon } from './Icon';
import { Text } from './Text';
import { colors, fontFamily, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { tabA11y } from '@/lib/a11y';

interface Props {
  focused: boolean;
  onPress?: (e: GestureResponderEvent) => void;
  /** The role the tab bar gives its own tabs ('tab'; 'button' on iOS). */
  role?: Role;
}

/**
 * Raised, FAB-style center tab for the personal barcode (Order Spec §1). It sits
 * elevated above the bar in the brand colour so "scan to pay & earn" is always
 * the most reachable action — Starbucks' centre-scan pattern.
 */
export function TabBarBarcodeButton({ focused, onPress, role }: Props) {
  const { t } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      style={styles.wrap}
      // One of the bar's five tabs, announced like its siblings — a "button"
      // inside the tablist broke it (axe aria-required-children).
      {...tabA11y(focused, t('tabs.barcode'))}
      role={role ?? 'tab'}
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
  // The same type as its sibling tabs (tabBarLabelStyle in (tabs)/_layout):
  // 11 pt is the iOS floor; it was 10.
  label: { fontFamily: fontFamily.medium, fontSize: 11, lineHeight: 16, marginTop: 2 },
});
