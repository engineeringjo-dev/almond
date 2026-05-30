import { View, StyleSheet, Pressable } from 'react-native';
import { Stack } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
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
        <Card style={styles.balanceCard}>
          <Text variant="caption" color={colors.lightGold}>
            {t('profile.walletBalance')}
          </Text>
          <Text variant="display" color={colors.cream}>
            {formatJOD(balance ?? 0, lang)}
          </Text>
        </Card>

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
              {amount >= 50 ? (
                <Text variant="caption" color={colors.green}>
                  🎡 +{t('home.spinWheel')}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>

        <Text variant="caption" color={colors.warmGray} style={styles.note}>
          {/* Pay-from-balance bonus + 50 JOD top-up spin (section 2.4). */}
          {lang === 'ar'
            ? 'الدفع من الرصيد يملأ كوبك بمعدل 1.5، وشحن 50 د.أ يمنحك دورة بعجلة الحظ.'
            : 'Paying from balance fills your cup at 1.5×, and a 50 JOD top-up grants a wheel spin.'}
        </Text>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  balanceCard: { backgroundColor: colors.dark, alignItems: 'center', gap: spacing.xs },
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
