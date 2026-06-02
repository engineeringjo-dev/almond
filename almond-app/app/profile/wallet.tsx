import { View, StyleSheet, Pressable } from 'react-native';
import { Stack } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Gradient } from '@/components/ui/Gradient';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
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

        <Text variant="caption" color={colors.warmGray} style={styles.note}>
          {/* Pay-from-balance fills the cup 1.5× faster (section 2.4). */}
          {lang === 'ar'
            ? 'الدفع من رصيدك يملأ كوبك بمعدل 1.5× أسرع.'
            : 'Paying from your balance fills your cup 1.5× faster.'}
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
  note: { marginTop: spacing.lg, textAlign: 'center' },
});
