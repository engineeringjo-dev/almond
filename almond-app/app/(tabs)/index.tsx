import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { HomeTopBar } from '@/components/home/HomeTopBar';
import { LoyaltyCard } from '@/components/home/LoyaltyCard';
import { QuickActions } from '@/components/home/QuickActions';
import { UsualOrderCard } from '@/components/home/UsualOrderCard';
import { VisitRewardBanner } from '@/components/home/VisitRewardBanner';
import { SpinHighlightCard } from '@/components/home/SpinHighlightCard';
import { PromoCarousel } from '@/components/home/PromoCarousel';
import { BranchCard } from '@/components/branch/BranchCard';
import { BranchPicker } from '@/components/branch/BranchPicker';
import { colors, spacing } from '@/constants/theme';
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

  const activeBranch = useMemo<Branch | undefined>(
    () => branches.find((b) => b.id === selectedBranchId) ?? nearest,
    [branches, selectedBranchId, nearest],
  );

  const greeting = new Date().getHours() < 12 ? 'home.greetingMorning' : 'home.greetingEvening';
  const name = user && !user.isGuest ? user.name : t('home.guest');

  return (
    <>
      <Screen
        loading={loading}
        error={error}
        onRetry={refetch}
        refreshing={false}
        onRefresh={refetch}
        edges={['top']}
      >
        <HomeTopBar branch={activeBranch} onBranchPress={() => setPickerOpen(true)} />

        <Text variant="h1" style={styles.greeting}>
          {t(greeting, { name })}
        </Text>

        <View style={styles.section}>
          <VisitRewardBanner />
        </View>

        <View style={styles.section}>
          <UsualOrderCard />
        </View>

        <View style={styles.section}>
          <LoyaltyCard />
        </View>

        <View style={styles.section}>
          <SpinHighlightCard />
        </View>

        <View style={styles.section}>
          <QuickActions />
        </View>

        <View style={styles.section}>
          <PromoCarousel />
        </View>

        <View style={styles.section}>
          <View style={styles.branchHeader}>
            <Text variant="title">{t('home.nearestBranches')}</Text>
            <Pressable onPress={() => setPickerOpen(true)} hitSlop={8}>
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

          <View style={styles.branchList}>
            {branches.slice(0, 3).map((b) => (
              <BranchCard
                key={b.id}
                branch={b}
                selected={b.id === activeBranch?.id}
                onPress={() => setBranch(b.id)}
              />
            ))}
          </View>
        </View>
      </Screen>

      <BranchPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        branches={branches}
        selectedId={activeBranch?.id}
        onSelect={(b) => setBranch(b.id)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  greeting: { marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl },
  branchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  locHint: { marginBottom: spacing.md },
  branchList: { gap: spacing.md },
});
