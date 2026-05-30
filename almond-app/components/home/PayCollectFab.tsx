import { StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';

/**
 * Sticky floating "Pay & earn points" button (Master Pack / Starbucks).
 * Fixed at the bottom-right, above the tab bar, within easy right-thumb reach;
 * stays put while the Home content scrolls. Uses the theme accent so it's a
 * very clear, prominent signifier. One tap → the personal barcode screen.
 */
export function PayCollectFab() {
  const { t } = useI18n();
  return (
    <Pressable
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
      onPress={() => router.push('/pay')}
      accessibilityRole="button"
      accessibilityLabel={t('pay.fabLabel')}
    >
      <Icon name="qr" size={22} color={colors.dark} />
      <Text variant="bodyBold" color={colors.dark} style={styles.label}>
        {t('pay.fabLabel')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    // Physical bottom-right for right-thumb reach (intentionally `right`, not
    // `end`, so it stays bottom-right even in RTL). Sits above the 64px tab bar.
    right: spacing.lg,
    bottom: 64 + spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadow.raised,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  label: {},
});
