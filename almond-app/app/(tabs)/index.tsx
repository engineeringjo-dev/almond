import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { HomeTopBar } from '@/components/home/HomeTopBar';
import { useLaunchSheets } from '@/hooks/useLaunchSheets';
import { LoyaltyCard } from '@/components/home/LoyaltyCard';
import { OrderNowButton } from '@/components/home/OrderNowButton';
import { PromoCarousel } from '@/components/home/PromoCarousel';
import { CateringEntry } from '@/components/home/CateringEntry';
import { UsualOrderCard } from '@/components/home/UsualOrderCard';
import { ActiveOrderBanner } from '@/components/home/ActiveOrderBanner';
import { ChallengeBanner } from '@/components/home/ChallengeBanner';
import { HomeNudge } from '@/components/home/HomeNudge';
import { PromotionBanner } from '@/components/home/PromotionBanner';
import { BranchPicker } from '@/components/branch/BranchPicker';
import { spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useNearestBranch } from '@/hooks/useNearestBranch';
import { useInvalidateLoyalty } from '@/hooks/useLoyalty';
import { useAuthStore } from '@/stores/authStore';
import { useCartStore } from '@/stores/cartStore';
import type { Branch } from '@/types';

/**
 * Home keeps membership and ordering first (precedent Starbucks):
 *
 *   1. The membership card: points, what they are worth, the wallet, and the
 *      code (owner: «نفذ ظهور الرمز أولاً», the code first).
 *   2. Order: «اطلب الآن», or «أكمل طلبك» when the cart holds something.
 *   3. «طلبك المعتاد», with a photograph, once there is one.
 *   4. A stationary campaign entry, followed by a compact catering contact.
 *
 * What it replaced was fourteen sections: the wallet, gift-card, nearest-
 * branch, «الأكثر طلباً» and offers cards and a list of three branches. The
 * wallet is on the card now, gift cards and the best sellers remain actionable
 * slides on /campaigns, and branches are behind the header's chip.
 *
 * Above the card only what is live: an order being made, and a promotion to
 * celebrate. Below the blocks, the nudges: the first-week ladder and a
 * double-points day or points about to expire.
 *
 * 🔴 NO WRAPPER AROUND A BLOCK THAT CAN BE EMPTY. A section View with a
 * margin stays on screen when its child renders nothing. That is the 76pt
 * blank the experts measured, under the nudges, on every launch with no
 * active order. Each block that can be empty carries its own margin.
 */
export default function HomeScreen() {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const { branches, nearest, loading, error, refetch } = useNearestBranch();
  const invalidateLoyalty = useInvalidateLoyalty();
  const selectedBranchId = useCartStore((s) => s.branchId);
  const setBranch = useCartStore((s) => s.setBranch);
  const [pickerOpen, setPickerOpen] = useState(false);
  // «اجمع نقاطك» opens by itself once per launch (lib/earnSheet.ts).
  useLaunchSheets();

  const activeBranch = useMemo<Branch | undefined>(
    () => branches.find((b) => b.id === selectedBranchId) ?? nearest,
    [branches, selectedBranchId, nearest],
  );

  // Guests get a name-less greeting ("Good morning" — not "Good morning, Guest").
  //
  // 🔴 A BLANK NAME TAKES THE GUEST BRANCH TOO, and that is the fix for the
  // mixed-language greeting: the mock auth used to sign a member in as NOT a
  // guest while handing over the literal 'ضيف ألموند', so `isGuest` was false,
  // this line took the named branch, and an English UI rendered
  // "Good evening, ضيف ألموند". The literal is gone (auth.service.ts), and
  // testing the NAME rather than only the flag means any producer that has no
  // name to give — the mock today, Odoo tomorrow for a customer record with an
  // empty field — gets a sentence that is whole in one language instead of a
  // dangling comma.
  const name = user?.name?.trim() ?? '';
  const isGuest = !user || user.isGuest;
  const base = new Date().getHours() < 12 ? 'Morning' : 'Evening';
  const greetingText = isGuest || name === ''
    ? t(`home.greeting${base}Guest`)
    : t(`home.greeting${base}`, { name });

  const refresh = () => {
    void refetch();
    invalidateLoyalty();
  };

  return (
    <View style={styles.root}>
      <Screen refreshing={false} onRefresh={refresh} edges={['top']}>
        <HomeTopBar
          branch={activeBranch}
          loading={loading}
          error={error}
          onRetry={() => void refetch()}
          onBranchPress={() => setPickerOpen(true)}
        />

        <Text variant="h2" style={styles.greeting} accessibilityRole="header">
          {greetingText}
        </Text>

        {/* Live, so above the card; each renders nothing when there is
            nothing to say, and carries its own margin. */}
        <ActiveOrderBanner />
        {/* 🎉 The promotion celebration: the rate changed at a till, possibly
            days ago, and this is the only place the member is told — see
            lib/promotion.ts. */}
        <PromotionBanner />

        <View style={styles.block}>
          <LoyaltyCard />
        </View>

        <View style={styles.block}>
          <OrderNowButton branch={activeBranch} />
        </View>

        <UsualOrderCard />

        <PromoCarousel />
        <CateringEntry />

        {/* The first-week ladder (fill in your details, then invite a friend),
            then the day's nudge. Both unwrapped, both nothing once done. */}
        <ChallengeBanner />
        <HomeNudge />
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
  greeting: { marginBottom: spacing.md },
  block: { marginBottom: spacing.lg },
});
