import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { BranchPicker } from '@/components/branch/BranchPicker';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { useNearestBranch } from '@/hooks/useNearestBranch';
import { useCartStore, useCartCount, computeTotals } from '@/stores/cartStore';

/**
 * Persistent pickup-store + cart bar pinned above the tab bar while ordering
 * (Starbucks pattern) — context never lost, cart always one tap away.
 */
export function PickupCartBar() {
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const { branches, nearest } = useNearestBranch();
  const branchId = useCartStore((s) => s.branchId);
  const setBranch = useCartStore((s) => s.setBranch);
  const items = useCartStore((s) => s.items);
  const count = useCartCount();
  const [pickerOpen, setPickerOpen] = useState(false);

  const branch = branches.find((b) => b.id === branchId) ?? nearest;
  const totals = computeTotals(items, 0);

  return (
    <>
      <View style={[styles.wrap, { bottom: 64 + Math.max(insets.bottom, 16) + spacing.sm }]}>
        <Pressable style={styles.store} onPress={() => setPickerOpen(true)} accessibilityRole="button">
          <View style={styles.storeIcon}>
            <Icon name="pickup" size={18} color={colors.primary} strokeWidth={2} />
          </View>
          <View style={styles.flex}>
            <Text variant="caption" color={colors.warmGray} numberOfLines={1}>
              {t('order.pickupFrom')}
            </Text>
            <Text variant="bodyBold" numberOfLines={1}>
              {branch ? (lang === 'ar' ? branch.nameAr : branch.nameEn) : t('order.chooseBranch')}
            </Text>
          </View>
        </Pressable>

        <Pressable style={styles.cart} onPress={() => router.push('/(tabs)/cart')} accessibilityRole="button">
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
        onSelect={(b) => setBranch(b.id)}
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
