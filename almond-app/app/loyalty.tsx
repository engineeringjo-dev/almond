import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Gradient } from '@/components/ui/Gradient';
import { Cup } from '@/components/loyalty/Cup';
import { TierBadge } from '@/components/loyalty/TierBadge';
import { TierProgress } from '@/components/loyalty/TierProgress';
import { VoucherCard } from '@/components/loyalty/VoucherCard';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatNumber, formatDate } from '@/lib/format';
import {
  useLoyaltyBalance,
  useVouchers,
  usePointsHistory,
} from '@/hooks/useLoyalty';
import type { Voucher, PointsLogEntry } from '@/types';

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
      <Screen onRefresh={balanceQ.refetch}>
        {/* Points balance — pastel rainbow hero, dark text for contrast */}
        <Gradient preset="rainbow" style={styles.pointsCard}>
          <Text variant="caption" color={colors.brown}>
            {t('loyalty.yourPoints')}
          </Text>
          <Text variant="display" color={colors.dark}>
            {formatNumber(balance.points, lang)} ☕
          </Text>
          <View style={styles.tierRow}>
            <TierBadge tier={balance.tier} />
          </View>
        </Gradient>

        {/* Cup */}
        <Card style={styles.cupCard}>
          <Cup current={balance.cup.current} target={balance.cup.target} size={120} />
          <View style={styles.cupInfo}>
            <Text variant="title">{t('loyalty.cupTitle')}</Text>
            <Text variant="h2" color={colors.gold}>
              {balance.cup.target - balance.cup.current <= 3 &&
              balance.cup.current < balance.cup.target
                ? t('loyalty.cupClose')
                : t('loyalty.cupProgress', {
                    current: Math.floor(balance.cup.current),
                    target: balance.cup.target,
                  })}
            </Text>
            <Text variant="caption" color={colors.warmGray}>
              {t('loyalty.cupHint')}
            </Text>
          </View>
        </Card>

        {/* Tier progress */}
        <Card style={styles.section}>
          <Text variant="title" style={styles.sectionTitle}>
            {t('loyalty.tier')}
          </Text>
          <TierProgress tier={balance.tier} windowSpend={balance.windowSpend} />
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
          <Card padded={false} style={styles.historyCard}>
            {(historyQ.data ?? []).map((h: PointsLogEntry, i: number) => (
              <View
                key={h.id}
                style={[styles.historyRow, i > 0 && styles.historyBorder]}
              >
                <View style={styles.historyBody}>
                  <Text variant="body">{lang === 'ar' ? h.reasonAr : h.reasonEn}</Text>
                  <Text variant="caption" color={colors.warmGray}>
                    {formatDate(h.createdAt, lang)}
                  </Text>
                </View>
                {h.deltaPoints !== 0 ? (
                  <Text
                    variant="bodyBold"
                    color={h.deltaPoints > 0 ? colors.green : colors.red}
                  >
                    {h.deltaPoints > 0 ? '+' : ''}
                    {h.deltaPoints}
                  </Text>
                ) : (
                  <Text variant="caption" color={colors.warmGray}>
                    🎡
                  </Text>
                )}
              </View>
            ))}
          </Card>
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
  cupCard: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  cupInfo: { flex: 1, gap: spacing.xs },
  section: { marginTop: spacing.lg },
  sectionTitle: { marginBottom: spacing.md },
  list: { gap: spacing.md },
  historyCard: { overflow: 'hidden' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  historyBody: { gap: 2 },
  historyBorder: { borderTopWidth: 1, borderTopColor: colors.cream },
});
