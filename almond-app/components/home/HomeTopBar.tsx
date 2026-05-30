import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useCartCount } from '@/stores/cartStore';
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
      <Text style={styles.logo}>☕</Text>

      <Pressable style={styles.chip} onPress={onBranchPress} hitSlop={6}>
        <Text style={styles.pin}>📍</Text>
        <Text variant="caption" color={colors.dark} numberOfLines={1} style={styles.chipText}>
          {branchName}
        </Text>
        <Text style={styles.caret}>⌄</Text>
      </Pressable>

      <View style={styles.actions}>
        <Pressable onPress={() => router.push('/notifications')} hitSlop={8} style={styles.iconBtn}>
          <Text style={styles.icon}>🔔</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/(tabs)/cart')} hitSlop={8} style={styles.iconBtn}>
          <Text style={styles.icon}>🛒</Text>
          {cartCount > 0 ? (
            <View style={styles.badge}>
              <Text variant="caption" color={colors.dark} style={styles.badgeText}>
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
  logo: { fontSize: 28 },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cardBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pin: { fontSize: 14 },
  chipText: { flex: 1 },
  caret: { color: colors.warmGray, fontSize: 16 },
  actions: { flexDirection: 'row', gap: spacing.xs },
  iconBtn: { padding: spacing.xs },
  icon: { fontSize: 22 },
  badge: {
    position: 'absolute',
    top: -2,
    end: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontWeight: '700', fontSize: 10 },
});
