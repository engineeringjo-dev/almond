import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useCartCount } from '@/stores/cartStore';
import { MIN_TOUCH_TARGET } from '@/lib/a11y';
import type { Branch } from '@/types';

interface Props {
  branch?: Branch;
  onBranchPress: () => void;
}

export function HomeTopBar({ branch, onBranchPress }: Props) {
  const { t, lang } = useI18n();
  const cartCount = useCartCount();
  const branchName = branch
    ? lang === 'ar'
      ? branch.nameAr
      : branch.nameEn
    : t('home.selectBranch');

  return (
    <View style={styles.bar}>
      <View style={styles.logo}>
        <Logo variant="badge" tone="dark" size={34} />
      </View>

      <Pressable
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        onPress={onBranchPress}
        accessibilityRole="button"
        accessibilityLabel={branch ? t('home.changeBranch', { branch: branchName }) : t('home.selectBranch')}
      >
        <Icon name="map-pin" size={15} color={colors.primary} />
        <Text variant="caption" color={colors.dark} numberOfLines={1} style={styles.chipText}>
          {branchName}
        </Text>
        <Icon name="chevron-down" size={16} color={colors.warmGray} />
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel={t('notifications.title')}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Icon name="bell" size={22} color={colors.dark} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/cart')}
          accessibilityRole="button"
          accessibilityLabel={cartCount > 0 ? t('home.cartWithCount', { count: cartCount }) : t('tabs.cart')}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Icon name="cart" size={22} color={colors.dark} />
          {cartCount > 0 ? (
            <View style={styles.badge}>
              <Text variant="caption" color={colors.white} style={styles.badgeText}>
                {cartCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  logo: { width: 38, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flex: 1,
    minWidth: 0,
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cardBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: { flex: 1, minWidth: 0 },
  pressed: { backgroundColor: colors.surface },
  actions: { flexDirection: 'row', gap: spacing.xs },
  iconBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    end: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontWeight: '700', fontSize: 10 },
});
