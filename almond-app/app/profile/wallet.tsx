import { View, StyleSheet, Pressable } from 'react-native';
import { Stack } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Gradient } from '@/components/ui/Gradient';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { reloadBonusBeans } from '@/lib/walletBonus';
import { useWallet, useTopUp } from '@/hooks/useLoyalty';

const TOPUP_OPTIONS = [10, 25, 50];

export default function WalletScreen() {
  const { t, lang } = useI18n();
  const { data: balance, isLoading, isError, refetch } = useWallet();
  const topUp = useTopUp();

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
          {TOPUP_OPTIONS.map((amount) => {
            const bonus = reloadBonusBeans(amount);
            return (
              <Pressable
                key={amount}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                onPress={() => topUp.mutate(amount)}
                disabled={topUp.isPending}
              >
                <Text variant="h2" color={colors.gold}>
                  {formatJOD(amount, lang)}
                </Text>
                {bonus > 0 ? (
                  <View style={styles.bonusPill}>
                    <Icon name="bean" size={12} color={colors.green} strokeWidth={2} />
                    <Text variant="caption" color={colors.green}>
                      {t('profile.reloadBonus', { beans: bonus })}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Text variant="caption" color={colors.green} center style={styles.bonusNote}>
          {t('profile.reloadBonusNote')}
        </Text>
        <Text variant="caption" color={colors.warmGray} style={styles.note}>
          {/* Pay-from-balance earns +50% beans (Wallet spec §1.2). */}
          {lang === 'ar'
            ? 'الدفع من رصيدك يكسبك +50% حبات (×1.5).'
            : 'Paying from your balance earns +50% beans (×1.5).'}
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
  bonusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(108,92,180,0.12)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  bonusNote: { marginTop: spacing.lg },
  note: { marginTop: spacing.xs, textAlign: 'center' },
});
