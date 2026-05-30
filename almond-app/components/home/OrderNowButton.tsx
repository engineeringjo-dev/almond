import { useState } from 'react';
import { StyleSheet, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { OrderTypeSheet } from '@/components/order/OrderTypeSheet';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';

/**
 * Prominent "Order now" CTA on Home (Master Pack §2). Opens the order-type
 * chooser first (pickup in-app / delivery external).
 */
export function OrderNowButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
      >
        <View style={styles.iconWrap}>
          <Icon name="cart" size={22} color={colors.gold} />
        </View>
        <Text variant="h2" color={colors.white} style={styles.label}>
          {t('home.quickOrder')}
        </Text>
        <Icon name="navigation" size={20} color={colors.gold} />
      </Pressable>
      <OrderTypeSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    ...shadow.raised,
  },
  pressed: { opacity: 0.92 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
});
