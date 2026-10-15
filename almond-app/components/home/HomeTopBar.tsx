import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';
import { Skeleton } from '@/components/ui/Skeleton';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useEarnSheetStore } from '@/stores/earnSheetStore';
import type { Branch } from '@/types';

interface Props {
  branch?: Branch;
  /** The branches are still loading (or the phone is still locating). */
  loading?: boolean;
  /** The branches did not load: the chip offers to try again. */
  error?: boolean;
  onRetry?: () => void;
  onBranchPress: () => void;
}

/**
 * HOME'S HEADER: the logo, the branch, the code and the notifications.
 *
 * Lighter than it was (expert panel, 2026-10-15). It had five controls. The
 * cart icon is gone, because the order block below becomes «أكمل طلبك» the
 * moment something is in the cart (OrderNowButton). Precedent: Talabat's
 * basket appears only when it holds something.
 *
 * The branch chip carries the branches' own state. While the phone locates
 * the member and the list loads, the chip shows a placeholder; if the list
 * fails, the chip offers to try again. Home is not replaced by a spinner or an
 * error for the length of a GPS fix. The membership card and the code do not
 * depend on the branches, and the code is what a member at the counter opened
 * the app for.
 */
export function HomeTopBar({ branch, loading, error, onRetry, onBranchPress }: Props) {
  const { t, lang } = useI18n();
  const openEarnSheet = useEarnSheetStore((s) => s.open);
  const branchName = branch ? (lang === 'ar' ? branch.nameAr : branch.nameEn) : t('home.selectBranch');

  return (
    <View style={styles.bar}>
      <View style={styles.logo}>
        <Logo variant="badge" size={34} />
      </View>

      {error && !branch ? (
        <Pressable style={styles.chip} onPress={onRetry} accessibilityRole="button">
          <Icon name="alert" size={15} color={colors.dark} />
          <Text variant="caption" color={colors.dark} numberOfLines={1} style={styles.chipText}>
            {t('home.branchesError')}
          </Text>
        </Pressable>
      ) : loading && !branch ? (
        <View style={styles.chip} accessibilityLabel={t('common.loading')}>
          <Icon name="map-pin" size={15} color={colors.dark} />
          <Skeleton width="60%" height={12} />
        </View>
      ) : (
        <Pressable style={styles.chip} onPress={onBranchPress} accessibilityRole="button">
          <Icon name="map-pin" size={15} color={colors.dark} />
          <Text variant="caption" color={colors.dark} numberOfLines={1} style={styles.chipText}>
            {branchName}
          </Text>
          <Icon name="chevron-down" size={16} color={colors.warmGray} />
        </Pressable>
      )}

      <View style={styles.actions}>
        {/* «اجمع نقاطك» on demand — the same sheet that opens on launch, a
            tap away from Home at any time (owner, 2026-10-15, after Al Ameed). */}
        <Pressable
          onPress={() => openEarnSheet()}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel={t('earnSheet.open')}
        >
          <Icon name="qr" size={22} color={colors.dark} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/notifications')}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel={t('notifications.title')}
        >
          <Icon name="bell" size={22} color={colors.dark} />
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
  /** The fill of a control, so it reads as something to press. It was the
   *  card colour, which is the page's white in light mode, so the chip was
   *  plain text with an arrow. */
  chip: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  chipText: { flex: 1 },
  actions: { flexDirection: 'row' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
