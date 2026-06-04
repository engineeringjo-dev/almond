import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';

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
import { WelcomeOffer } from '@/components/home/WelcomeOffer';
import { FeaturedRow } from '@/components/home/FeaturedRow';
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

  // Guests get a name-less greeting ("Good morning" — not "Good morning, Guest").
  const isGuest = !user || user.isGuest;
  const base = new Date().getHours() < 12 ? 'Morning' : 'Evening';
  const greetingText = isGuest
    ? t(`home.greeting${base}Guest`)
    : t(`home.greeting${base}`, { name: user!.name });

  return (
    <View style={styles.root}>
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
          {greetingText}
        </Text>

        {/* Live active-order status, front-and-centre (Starbucks pattern) */}
        <View style={styles.section}>
          <ActiveOrderBanner />
        </View>

        {/* Starbucks layout (Master Pack §2): rewards hero → order CTA → wallet
            → usual → horizontal sections → branches, with generous spacing. */}
        <View style={styles.section}>
          <WelcomeOffer />
        </View>

        <View style={styles.section}>
          <VisitRewardBanner />
        </View>

        <View style={styles.heroSection}>
          <LoyaltyCard />
        </View>

        <View style={styles.section}>
          <OrderNowButton />
        </View>

        <View style={styles.section}>
          <WalletCard />
        </View>

        <View style={styles.section}>
          <GiftCardHome />
        </View>

        <View style={styles.section}>
          <NearestBranchButton />
        </View>

        <View style={styles.section}>
          <UsualOrderCard />
        </View>

        <View style={styles.section}>
          <FeaturedRow />
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  greeting: { marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl + spacing.xs },
  heroSection: { marginBottom: spacing.xl + spacing.sm },
  branchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  locHint: { marginBottom: spacing.md },
  branchList: { gap: spacing.md },
});
