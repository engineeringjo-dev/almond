import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { BalanceWorth } from '@/components/loyalty/BalanceWorth';
import { PointsHistory } from '@/components/loyalty/PointsHistory';
import { PointsOwedNote } from '@/components/loyalty/PointsOwedNote';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatNumber } from '@/lib/format';
import { useLoyaltyBalance, usePointsHistory } from '@/hooks/useLoyalty';

/**
 * «سجل النقاط» — the balance in one line, then the ledger.
 *
 * Precedent: Al Ameed's «نقاطي» page, a door off its points hub. This screen
 * was titled «المكافآت» like the tab it opens from, and carried a second black
 * card, the tier ladder and the coupons before the first line of history (at
 * ~745 pt). The tier is /tiers now and the coupons /vouchers, both off the
 * Rewards tab; what is left is the history, with a compact summary on the
 * page's resting fill rather than another black card.
 */
export default function LoyaltyScreen() {
  const { t, lang } = useI18n();
  const balanceQ = useLoyaltyBalance();
  const historyQ = usePointsHistory();

  const loading = balanceQ.isLoading;
  if (loading || balanceQ.isError || !balanceQ.data) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: t('loyalty.history') }} />
        <Screen loading={loading} error={balanceQ.isError} onRetry={balanceQ.refetch} />
      </>
    );
  }

  const balance = balanceQ.data;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('loyalty.history') }} />
      <Screen onRefresh={balanceQ.refetch} scrollLabel={t('loyalty.history')}>
        <View style={styles.summary}>
          <Text variant="caption" color={colors.warmGray}>
            {t('loyalty.yourPoints')}
          </Text>
          <Text variant="h1" center>
            {formatNumber(balance.points, lang)}
          </Text>
          <BalanceWorth points={balance.points} tone="page" />
          {/* The history below says which refund and which deduction. */}
          <PointsOwedNote points={balance.pointsOwed} />
        </View>

        <PointsHistory entries={historyQ.data ?? []} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  summary: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
});
