import { View, StyleSheet, Pressable } from 'react-native';
import { router, Stack } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Cup } from '@/components/loyalty/Cup';
import { TierBadge } from '@/components/loyalty/TierBadge';
import { TierProgress } from '@/components/loyalty/TierProgress';
import { VoucherCard } from '@/components/loyalty/VoucherCard';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
import { formatNumber, formatDate } from '@/lib/format';
import {
  useLoyaltyBalance,
  useVouchers,
  usePointsHistory,
  useSpinEligibility,
  useRedeem,
} from '@/hooks/useLoyalty';
import type { Voucher, PointsLogEntry } from '@/types';

export default function LoyaltyScreen() {
  const { t, lang } = useI18n();
  const balanceQ = useLoyaltyBalance();
  const vouchersQ = useVouchers();
  const historyQ = usePointsHistory();
  const eligibilityQ = useSpinEligibility();
  const redeem = useRedeem();

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
  const worth = (balance.points / config.POINTS_PER_JOD_REDEEM).toFixed(3);
  const redeemable = Math.floor(balance.points / 100) * 100;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('loyalty.title') }} />
      <Screen onRefresh={balanceQ.refetch}>
        {/* Points balance */}
        <Card style={styles.pointsCard}>
          <Text variant="caption" color={colors.lightGold}>
            {t('loyalty.yourPoints')}
          </Text>
          <Text variant="display" color={colors.cream}>
            {formatNumber(balance.points, lang)}
          </Text>
          <Text variant="caption" color={colors.lightGold}>
            {t('loyalty.worth', { jod: worth })}
          </Text>
          <View style={styles.tierRow}>
            <TierBadge tier={balance.tier} />
          </View>
          {redeemable >= 100 ? (
            <Button
              title={`${t('loyalty.redeem')} (${redeemable} → ${(redeemable / 100).toFixed(0)} ${t('common.currency')})`}
              variant="outline"
              onPress={() => redeem.mutate(redeemable)}
              loading={redeem.isPending}
              style={styles.redeemBtn}
            />
          ) : null}
        </Card>

        {/* Cup */}
        <Card style={styles.cupCard}>
          <Cup current={balance.cup.current} target={balance.cup.target} size={120} />
          <View style={styles.cupInfo}>
            <Text variant="title">{t('loyalty.cupTitle')}</Text>
            <Text variant="h2" color={colors.gold}>
              {t('loyalty.cupProgress', {
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
          <TierProgress tier={balance.tier} lifetimeSpend={balance.lifetimeSpend} />
        </Card>

        {/* Spin CTA */}
        <Pressable onPress={() => router.push('/spin')} accessibilityRole="button">
          <View style={styles.spinCard}>
            <Text style={styles.spinEmoji}>🎡</Text>
            <View style={styles.spinBody}>
              <Text variant="title" color={colors.cream}>
                {t('loyalty.spin')}
              </Text>
              <Text variant="caption" color={colors.lightGold}>
                {eligibilityQ.data?.canSpin
                  ? t('spin.spinsLeft', { count: eligibilityQ.data.spinsAvailable })
                  : t('loyalty.spinCta')}
              </Text>
            </View>
            <Text style={styles.chevron}>{lang === 'ar' ? '‹' : '›'}</Text>
          </View>
        </Pressable>

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
  pointsCard: { backgroundColor: colors.dark, alignItems: 'center', gap: spacing.xs },
  tierRow: { marginTop: spacing.sm },
  redeemBtn: { marginTop: spacing.md, alignSelf: 'stretch' },
  cupCard: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  cupInfo: { flex: 1, gap: spacing.xs },
  section: { marginTop: spacing.lg },
  sectionTitle: { marginBottom: spacing.md },
  spinCard: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.brown,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  spinEmoji: { fontSize: 40 },
  spinBody: { flex: 1, gap: 2 },
  chevron: { fontSize: 28, color: colors.lightGold },
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
