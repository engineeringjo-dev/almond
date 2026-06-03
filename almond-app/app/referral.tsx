import { View, StyleSheet, Share, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, spacing, radius } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
import { loyaltyService } from '@/services/loyalty.service';
import { useUserId } from '@/stores/authStore';

export default function ReferralScreen() {
  const { t } = useI18n();
  const userId = useUserId();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['loyalty', 'referral', userId],
    queryFn: () => loyaltyService.getReferralCode(userId),
  });

  const link = `${config.DELIVERY_REDIRECT_URL.replace('/order', '')}/app`;

  const onShare = async () => {
    if (!data) return;
    await Share.share({
      message: t('referral.shareMessage', { link, code: data.code }),
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('referral.title') }} />
      <Screen loading={isLoading} error={isError} onRetry={refetch}>
        <View style={styles.hero}>
          <Text style={styles.emoji}>👥</Text>
          <Text variant="h1" center>
            {t('referral.headline')}
          </Text>
        </View>

        {data?.alreadyRewarded ? (
          <Card style={styles.thanksCard}>
            <Text variant="h2" center color={colors.green}>
              {t('referral.rewarded')}
            </Text>
            <Text variant="body" center color={colors.warmGray}>
              {t('referral.thanks')}
            </Text>
          </Card>
        ) : (
          <>
            <Card style={styles.codeCard}>
              <Text variant="caption" color={colors.warmGray}>
                {t('referral.yourCode')}
              </Text>
              <Text variant="display" color={colors.gold} style={styles.code}>
                {data?.code}
              </Text>
              <View style={styles.statusPill}>
                <Text variant="caption" color={colors.brown}>
                  {t('referral.notUsed')}
                </Text>
              </View>
            </Card>
            <Button title={t('referral.share')} onPress={onShare} leadingEmoji="📤" />
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  emoji: { fontSize: 64 },
  codeCard: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  code: { letterSpacing: 4 },
  statusPill: {
    backgroundColor: colors.neutralWarm,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  thanksCard: { alignItems: 'center', gap: spacing.sm },
});
