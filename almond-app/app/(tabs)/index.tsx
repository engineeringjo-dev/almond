import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';

import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { HomeTopBar } from '@/components/home/HomeTopBar';
import { LoyaltyCard } from '@/components/home/LoyaltyCard';
import { UsualOrderCard } from '@/components/home/UsualOrderCard';
import { VisitRewardBanner } from '@/components/home/VisitRewardBanner';
import { NearestBranchButton } from '@/components/home/NearestBranchButton';
import { OrderNowButton } from '@/components/home/OrderNowButton';
import { WalletCard } from '@/components/home/WalletCard';
import { GiftCardHome } from '@/components/home/GiftCardHome';
import { ActiveOrderBanner } from '@/components/home/ActiveOrderBanner';
import { FeaturedRow } from '@/components/home/FeaturedRow';
import { ChallengeBanner } from '@/components/home/ChallengeBanner';
import { HomeNudge } from '@/components/home/HomeNudge';
import { PromotionBanner } from '@/components/home/PromotionBanner';
import { PromoCarousel } from '@/components/home/PromoCarousel';
import { BranchCard } from '@/components/branch/BranchCard';
import { BranchPicker } from '@/components/branch/BranchPicker';
import { Button } from '@/components/ui/Button';
import { MIN_TOUCH_TARGET } from '@/lib/a11y';
import { colors, spacing, layout } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useNearestBranch } from '@/hooks/useNearestBranch';
import { useAuthStore } from '@/stores/authStore';
import { useCartStore } from '@/stores/cartStore';
import type { Branch } from '@/types';

export default function HomeScreen() {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const { branches, nearest, permissionDenied, loading, error, refetch } = useNearestBranch();
  const selectedBranchId = useCartStore((s) => s.branchId);
  const setBranch = useCartStore((s) => s.setBranch);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ['loyalty'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const activeBranch = useMemo<Branch | undefined>(
    () => branches.find((b) => b.id === selectedBranchId) ?? nearest,
    [branches, selectedBranchId, nearest],
  );

  // Missing names use a complete, translated greeting in either language.
  const name = user?.name?.trim() ?? '';
  const isGuest = !user || user.isGuest;
  const base = new Date().getHours() < 12 ? 'Morning' : 'Evening';
  const greetingText = isGuest || name === ''
    ? t(`home.greeting${base}Guest`)
    : t(`home.greeting${base}`, { name });

  return (
    <View style={styles.root}>
      <Screen
        contentStyle={styles.content}
        refreshing={refreshing}
        onRefresh={refresh}
        edges={['top']}
      >
        <HomeTopBar branch={activeBranch} onBranchPress={() => setPickerOpen(true)} />

        <Text variant="h1" style={styles.greeting}>
          {greetingText}
        </Text>

        {/* Keep the current order and everyday actions ahead of campaigns.
            Gap is applied only between rendered children: absent banners and
            a missing usual order leave no empty sections behind. */}
        <View testID="home-primary" style={styles.primary}>
          <ActiveOrderBanner />
          <VisitRewardBanner />
          <LoyaltyCard />
          <OrderNowButton />
          <UsualOrderCard />
        </View>

        <PromotionBanner />
        <ChallengeBanner />
        <HomeNudge />

        <View style={styles.section}>
          <FeaturedRow />
        </View>

        <View style={styles.section}>
          <WalletCard />
        </View>

        <View style={styles.section}>
          <GiftCardHome />
        </View>

        <View style={styles.section}>
          <PromoCarousel />
        </View>

        <View style={styles.section}>
          <View style={styles.branchHeader}>
            <Text variant="title" style={styles.branchTitle}>
              {t(permissionDenied ? 'home.ourBranches' : 'home.nearestBranches')}
            </Text>
            <Pressable
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('home.viewAllBranches')}
              disabled={branches.length === 0}
              aria-disabled={branches.length === 0}
              style={({ pressed }) => [styles.viewAll, pressed && styles.pressed]}
            >
              <Text variant="caption" color={colors.gold}>
                {t('home.viewAll')}
              </Text>
            </Pressable>
          </View>

          {permissionDenied ? (
            <Text variant="caption" color={colors.warmGray} style={styles.locHint}>
              {t('home.noBranchLocation')}
            </Text>
          ) : null}

          {error ? (
            <View style={styles.branchState}>
              <Text variant="body" color={colors.warmGray}>{t('home.branchesUnavailable')}</Text>
              <Button title={t('common.retry')} onPress={() => { void refetch(); }} variant="outline" />
            </View>
          ) : loading && branches.length === 0 ? (
            <View style={styles.branchState}>
              <ActivityIndicator color={colors.primary} accessibilityLabel={t('common.loading')} />
              <Text variant="caption" color={colors.warmGray}>{t('common.loading')}</Text>
            </View>
          ) : branches.length === 0 ? (
            <Text variant="body" color={colors.warmGray}>{t('home.noBranches')}</Text>
          ) : null}

          <View style={styles.branchList}>
            {branches.slice(0, 3).map((b) => (
              <BranchCard
                key={b.id}
                branch={b}
                selected={b.id === activeBranch?.id}
                onPress={() => setBranch(b)}
              />
            ))}
          </View>
          {branches.length > 0 ? (
            <View style={styles.nearestAction}><NearestBranchButton /></View>
          ) : null}
        </View>
      </Screen>

      <BranchPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        branches={branches}
        selectedId={activeBranch?.id}
        onSelect={(b) => setBranch(b)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center' },
  greeting: { marginBottom: spacing.xl },
  primary: { gap: spacing.lg, marginBottom: spacing.xl },
  section: { marginBottom: spacing.xxl },
  branchTitle: { flex: 1, minWidth: 0 },
  viewAll: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: spacing.sm },
  pressed: { opacity: 0.7 },
  branchState: { gap: spacing.md, marginBottom: spacing.lg },
  nearestAction: { marginTop: spacing.lg },
  branchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  locHint: { marginBottom: spacing.md },
  branchList: { gap: spacing.md },
});
