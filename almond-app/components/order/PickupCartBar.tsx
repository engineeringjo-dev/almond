import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { BranchPicker } from '@/components/branch/BranchPicker';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { useCartBranch } from '@/hooks/useCartBranch';
import { useCartStore, useCartCount, computeTotals } from '@/stores/cartStore';

/**
 * Persistent pickup-store + cart bar pinned above the tab bar while ordering
 * (Starbucks pattern) — context never lost, cart always one tap away.
 */
export function PickupCartBar() {
  const { t, lang } = useI18n();
  // The same branch the cart will show — resolved in one place, so the bar
  // never names a closed or vanished branch the cart then moves off.
  const { branches, branch } = useCartBranch();
  const setBranch = useCartStore((s) => s.setBranch);
  const items = useCartStore((s) => s.items);
  const count = useCartCount();
  const [pickerOpen, setPickerOpen] = useState(false);

  const totals = computeTotals(items, 0);

  return (
    <>
      {/* The screen content already ends at the tab-bar top (react-navigation
          reserves its space), so the bar only needs a small gap above it. */}
      <View style={[styles.wrap, { bottom: spacing.sm }]}>
        <Pressable style={styles.store} onPress={() => setPickerOpen(true)} accessibilityRole="button">
          <View style={styles.storeIcon}>
            <Icon name="pickup" size={18} color={colors.primary} strokeWidth={2} />
          </View>
          <View style={styles.flex}>
            <Text variant="caption" color={colors.warmGray} numberOfLines={1}>
              {t('order.pickupFrom')}
            </Text>
            {/* Branch name + chevron signals the pickup store can be changed */}
            <View style={styles.nameRow}>
              <Text variant="bodyBold" numberOfLines={1} style={styles.flex}>
                {branch ? (lang === 'ar' ? branch.nameAr : branch.nameEn) : t('order.chooseBranch')}
              </Text>
              <Icon name="chevron-down" size={16} color={colors.warmGray} strokeWidth={2.5} />
            </View>
          </View>
        </Pressable>

        {/* The one way into the cart from the menu, so it says so: the visible
            badge and total alone read as "1, 3.500" to a screen reader. */}
        <Pressable
          style={styles.cart}
          onPress={() => router.push('/cart')}
          accessibilityRole="button"
          accessibilityLabel={t('order.cartButton', { count, total: formatJOD(totals.total, lang) })}
        >
          <Icon name="cart" size={20} color={colors.white} />
          {count > 0 ? (
            <View style={styles.badge}>
              <Text variant="caption" color={colors.dark} style={styles.badgeText}>{count}</Text>
            </View>
          ) : null}
          <Text variant="bodyBold" color={colors.white}>
            {count > 0 ? formatJOD(totals.total, lang) : t('order.viewCart')}
          </Text>
        </Pressable>
      </View>

      <BranchPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        branches={branches}
        selectedId={branch?.id}
        onSelect={(b) => setBranch(b)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    start: spacing.md,
    end: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    ...shadow.raised,
  },
  flex: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  store: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  storeIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center', justifyContent: 'center',
  },
  cart: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.dark,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  badge: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: colors.lightGold,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
