import { View, StyleSheet, Pressable } from 'react-native';
import { Stack } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Gradient } from '@/components/ui/Gradient';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { useWallet, useTopUp } from '@/hooks/useLoyalty';
import { useWalletRate } from '@/hooks/useWalletRate';

// The one-tap top-up amounts. They used to be aligned with the reload-bonus
// thresholds (20 → +50, 35 → +120); that bonus is deleted (owner, 2026-10-15),
// so these are just amounts and earn nothing until they are spent.
const TOPUP_OPTIONS = [20, 35, 50];

export default function WalletScreen() {
  const { t, lang } = useI18n();
  const { data: balance, isLoading, isError, refetch } = useWallet();
  const topUp = useTopUp();
  const walletRate = useWalletRate();

  return (
    <>
      <Stack.Screen options={{ title: t('profile.wallet') }} />
      <Screen loading={isLoading} error={isError} onRetry={refetch}>
        <Gradient preset="purple" style={styles.balanceCard}>
          <Text variant="caption" color={colors.white}>
            {t('profile.walletBalance')}
          </Text>
          <Text variant="display" color={colors.white}>
            {formatJOD(balance ?? 0, lang)}
          </Text>
        </Gradient>

        <Text variant="title" style={styles.heading}>
          {t('profile.topUp')}
        </Text>
        <View style={styles.options}>
          {TOPUP_OPTIONS.map((amount) => (
            <Pressable
              key={amount}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
              onPress={() => topUp.mutate(amount)}
              disabled={topUp.isPending}
            >
              <Text variant="h2" color={colors.gold}>
                {formatJOD(amount, lang)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* The wallet's bonus is for SPENDING it (owner, 2026-10-15: «لا يوجد
            بونص شحن، البونص للانفاق فقط»), so this states the member's rate
            from the balance beside their rate otherwise — both read off the
            rung and config.WALLET_EARN_MULTIPLIER by useWalletRate. It replaced
            a reload-bonus pill on each amount and a «اشحن أكثر واكسب نقاطاً
            إضافية» note: top-ups earn nothing. */}
        <Text variant="caption" color={colors.green} center style={styles.bonusNote}>
          {t('profile.walletEarnNote', walletRate)}
        </Text>
      </Screen>
    </>
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
  option: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    ...shadow.card,
  },
  pressed: { opacity: 0.85 },
  bonusNote: { marginTop: spacing.lg },
});
