import { View, StyleSheet, Pressable } from 'react-native';
import { Stack } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { HeroCard } from '@/components/ui/HeroCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { GiftClaimForm } from '@/components/gift/GiftClaimForm';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatDate, formatJOD, formatJODHeld, formatSignedJOD } from '@/lib/format';
import { MIN_TOUCH_TARGET } from '@/lib/a11y';
import { useWallet, useTopUp, usePointsHistory } from '@/hooks/useLoyalty';
import { useWalletRate } from '@/hooks/useWalletRate';
import { branches } from '@/services/seed';
import { walletStatement } from '@almond/shared/loyalty/history';
import type { PointsLogEntry } from '@/types';

// The one-tap top-up amounts. They used to be aligned with the reload-bonus
// thresholds (20 → +50, 35 → +120); that bonus is deleted (owner, 2026-10-15),
// so these are just amounts and earn nothing until they are spent.
const TOPUP_OPTIONS = [20, 35, 50];

/**
 * «الرصيد والمحفظة» — the balance, how to add to it, and what moved it.
 *
 * Expert panel, 2026-10-15: the wallet was a balance and three amounts over an
 * empty screen, «بلا كشف حركات». The statement is the wallet's lines of the one
 * ledger (loyalty/history.ts walletStatement): every top-up, gift card,
 * payment from the balance, transfer and expiry, each with its money in its
 * own column, newest first. Precedent: a bank's or Apple Wallet's
 * transactions under the card; Starbucks' card "History".
 */
export default function WalletScreen() {
  const { t, lang } = useI18n();
  const { data: balance, isLoading, isError, refetch } = useWallet();
  const historyQ = usePointsHistory();
  const topUp = useTopUp();
  const walletRate = useWalletRate();
  const moves = walletStatement(historyQ.data ?? []);

  return (
    <>
      <Stack.Screen options={{ title: t('profile.wallet') }} />
      <Screen loading={isLoading} error={isError} onRetry={refetch} onRefresh={refetch}>
        <HeroCard style={styles.balanceCard}>
          <Text variant="caption" color={colors.onHeroMuted}>
            {t('profile.walletBalance')}
          </Text>
          <Text variant="display" color={colors.onHero} testID="wallet-balance">
            {formatJODHeld(balance ?? 0, lang)}
          </Text>
          {/* The wallet's bonus is for SPENDING it (owner, 2026-10-15: «لا يوجد
              بونص شحن، البونص للانفاق فقط»): the member's rate from the
              balance beside their rate otherwise, off the rung and
              config.WALLET_EARN_MULTIPLIER (useWalletRate). */}
          <Text variant="caption" color={colors.onHeroMuted} center>
            {t('profile.walletEarnNote', walletRate)}
          </Text>
        </HeroCard>

        <Text variant="title" style={styles.heading}>
          {t('profile.topUp')}
        </Text>
        <View style={styles.options}>
          {TOPUP_OPTIONS.map((amount) => (
            <Pressable
              key={amount}
              style={({ pressed }) => [styles.option, (pressed || topUp.isPending) && styles.pressed]}
              onPress={() => topUp.mutate(amount)}
              disabled={topUp.isPending}
              accessibilityRole="button"
              aria-label={t('profile.topUpA11y', { amount: formatJOD(amount, lang) })}
            >
              <Text variant="title" color={colors.dark}>
                {formatJOD(amount, lang)}
              </Text>
            </Pressable>
          ))}
        </View>
        {/* A top-up that did not go through says so; it used to fail in
            silence and the balance simply did not move. */}
        {topUp.isError ? (
          <Text variant="caption" color={colors.red} style={styles.error} aria-live="polite">
            {t('profile.topUpFailed')}
          </Text>
        ) : null}

        <View style={styles.giftClaim}>
          <GiftClaimForm />
        </View>

        <Text variant="title" style={styles.heading}>
          {t('profile.walletStatement')}
        </Text>
        {historyQ.isLoading ? (
          <Card padded={false}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.row, i > 0 && styles.border]}>
                <View style={styles.body}>
                  <Skeleton width="55%" height={14} />
                  <Skeleton width="35%" height={12} />
                </View>
                <Skeleton width={64} height={16} />
              </View>
            ))}
          </Card>
        ) : moves.length === 0 ? (
          <Card style={styles.empty}>
            <Icon name="receipt" size={28} color={colors.warmGray} strokeWidth={1.6} />
            <Text variant="bodyBold" center>
              {t('profile.walletEmpty')}
            </Text>
            <Text variant="caption" color={colors.warmGray} center>
              {t('profile.walletEmptyHint')}
            </Text>
          </Card>
        ) : (
          <Card padded={false} style={styles.list}>
            {moves.map((m, i) => (
              <MoveRow key={m.id} move={m} first={i === 0} />
            ))}
          </Card>
        )}
      </Screen>
    </>
  );
}

function MoveRow({ move, first }: { move: PointsLogEntry; first: boolean }) {
  const { t, lang } = useI18n();
  const fils = move.deltaFils ?? 0;
  const branch = move.branchId ? branches.find((b) => b.id === move.branchId) : undefined;
  const meta = [
    formatDate(move.createdAt, lang),
    branch ? t('loyalty.historyBranch', { name: lang === 'ar' ? branch.nameAr : branch.nameEn }) : null,
  ].filter(Boolean).join(' · ');
  return (
    <View style={[styles.row, !first && styles.border]}>
      <View style={styles.body}>
        <Text variant="body">{lang === 'ar' ? move.reasonAr : move.reasonEn}</Text>
        <Text variant="caption" color={colors.warmGray}>
          {meta}
        </Text>
      </View>
      {/* Money in is green; money out is the ink — paying is not an error. */}
      <Text variant="bodyBold" color={fils > 0 ? colors.green : colors.dark} style={styles.amount}>
        {formatSignedJOD(fils / 1000, lang)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  balanceCard: {
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    padding: spacing.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  heading: { marginTop: spacing.xl, marginBottom: spacing.md },
  options: { flexDirection: 'row', gap: spacing.md },
  // A control: its own fill and a ≥3:1 edge (theme `outline`).
  option: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET + spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
  },
  pressed: { opacity: 0.6 },
  error: { marginTop: spacing.sm },
  giftClaim: { marginTop: spacing.xl },
  empty: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xl },
  list: { overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
  },
  body: { flex: 1, gap: spacing.xs },
  border: { borderTopWidth: 1, borderTopColor: colors.neutralWarm },
  amount: { fontVariant: ['tabular-nums'] },
});
