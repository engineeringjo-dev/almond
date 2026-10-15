import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { HeroCard } from '@/components/ui/HeroCard';
import { TierBadge } from '@/components/loyalty/TierBadge';
import { TierProgress } from '@/components/loyalty/TierProgress';
import { BalanceWorth } from '@/components/loyalty/BalanceWorth';
import { VoucherCard } from '@/components/loyalty/VoucherCard';
import { PointsHistory } from '@/components/loyalty/PointsHistory';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatNumber } from '@/lib/format';
import {
  useLoyaltyBalance,
  useVouchers,
  usePointsHistory,
} from '@/hooks/useLoyalty';
import type { Voucher } from '@/types';

export default function LoyaltyScreen() {
  const { t, lang } = useI18n();
  const balanceQ = useLoyaltyBalance();
  const vouchersQ = useVouchers();
  const historyQ = usePointsHistory();

  const loading = balanceQ.isLoading;
  if (loading || balanceQ.isError || !balanceQ.data) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: t('loyalty.title') }} />
        <Screen loading={loading} error={balanceQ.isError} onRetry={balanceQ.refetch} />
      </>
    );
  }

  const balance = balanceQ.data;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('loyalty.title') }} />
      <Screen onRefresh={balanceQ.refetch} scrollLabel={t('loyalty.title')}>
        {/* Points balance — on the black card */}
        <HeroCard style={styles.pointsCard}>
          <Text variant="caption" color={colors.onHeroMuted}>
            {t('loyalty.yourPoints')}
          </Text>
          <Text variant="display" color={colors.onHero}>
            {formatNumber(balance.points, lang)}
          </Text>
          <BalanceWorth points={balance.points} />
          <View style={styles.tierRow}>
            <TierBadge tier={balance.tier} onHero />
          </View>
        </HeroCard>


        {/* Tier progress */}
        <Card style={styles.section}>
          <Text variant="title" style={styles.sectionTitle}>
            {t('loyalty.tier')}
          </Text>
          <TierProgress
            tier={balance.tier}
            windowSpend={balance.windowSpend}
            nextTier={balance.nextTier}
          />
        </Card>

        {/* Vouchers */}
        <View style={styles.section}>
          <Text variant="title" style={styles.sectionTitle}>
            {t('loyalty.vouchers')}
          </Text>
          {vouchersQ.data && vouchersQ.data.length > 0 ? (
            <View style={styles.list}>
              {vouchersQ.data.map((v: Voucher) => (
                <VoucherCard key={v.id} voucher={v} />
              ))}
            </View>
          ) : (
            <Text variant="caption" color={colors.warmGray}>
              {t('loyalty.noVouchers')}
            </Text>
          )}
        </View>

        {/* Points history */}
        <View style={styles.section}>
          <Text variant="title" style={styles.sectionTitle}>
            {t('loyalty.history')}
          </Text>
          <PointsHistory entries={historyQ.data ?? []} />
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  pointsCard: {
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    padding: spacing.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  tierRow: { marginTop: spacing.sm },
  section: { marginTop: spacing.lg },
  sectionTitle: { marginBottom: spacing.md },
  list: { gap: spacing.md },
});
