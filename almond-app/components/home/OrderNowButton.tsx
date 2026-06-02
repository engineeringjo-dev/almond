import { useState } from 'react';
import { StyleSheet, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Gradient } from '@/components/ui/Gradient';
import { OrderTypeSheet } from '@/components/order/OrderTypeSheet';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';

/**
 * Prominent "Order now" CTA on Home (Master Pack §2). Opens the order-type
 * chooser first (pickup in-app / delivery external). Purple gradient (per design).
 */
export function OrderNowButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.shadow, pressed && styles.pressed]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
      >
        <Gradient preset="purple" style={styles.btn}>
          <View style={styles.iconWrap}>
            <Icon name="cart" size={22} color={colors.white} />
          </View>
          <Text variant="h2" color={colors.white} style={styles.label}>
            {t('home.quickOrder')}
          </Text>
          <Icon name="navigation" size={20} color={colors.white} />
        </Gradient>
      </Pressable>
      <OrderTypeSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  shadow: { borderRadius: radius.lg, ...shadow.raised },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.92 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
});
