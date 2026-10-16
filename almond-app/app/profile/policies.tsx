import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { ltrIsolate } from '@almond/shared/lib/phone';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { config } from '@/constants/config';
import { spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatNumber } from '@/lib/format';

/**
 * Public programme rules, with the same dials as the server. No account or
 * balance is needed to read them. Precedent: Starbucks' separately linked
 * rewards rules, grouped by earning, expiry and referral conditions.
 */
export default function PoliciesScreen() {
  const { t, lang } = useI18n();

  return (
    <>
      <Stack.Screen options={{ title: t('policies.title') }} />
      <Screen scrollLabel={t('policies.title')}>
        <View style={styles.sections}>
          <View style={styles.section}>
            <Text variant="h2" role="heading" aria-level={2}>{t('policies.pointsTitle')}</Text>
            <Text selectable>
              {t('policies.pointsLife', {
                count: config.POINT_LOT_LIFE_MONTHS,
                months: formatNumber(config.POINT_LOT_LIFE_MONTHS, lang),
              })}
            </Text>
            <Text selectable>{t('policies.pointsDates')}</Text>
            <Text selectable>{t('policies.unusedReturn')}</Text>
            <Text selectable>{t('policies.returnReview')}</Text>
          </View>

          <View style={styles.section}>
            <Text variant="h2" role="heading" aria-level={2}>{t('policies.referralTitle')}</Text>
            <Text selectable>
              {t('policies.referralReward', { points: formatNumber(config.REFERRAL_REWARD_POINTS, lang) })}
            </Text>
            <Text selectable>{t('policies.referralPayment')}</Text>
            <Text selectable>{t('policies.referralPhones', { prefix: ltrIsolate('+962') })}</Text>
            <Text selectable>{t('policies.referralAttach')}</Text>
            <Text selectable>{t('policies.referralCorporate')}</Text>
            <Text selectable>
              {t('policies.referralCap', { points: formatNumber(config.REFERRAL_LIFETIME_CAP_POINTS, lang) })}
            </Text>
            <Text selectable>{t('policies.referralNoReset')}</Text>
          </View>

          <View style={styles.section}>
            <Text variant="h2" role="heading" aria-level={2}>{t('policies.refundTitle')}</Text>
            <Text selectable>{t('policies.refundEarned')}</Text>
            <Text selectable>{t('policies.refundMoney')}</Text>
            <Text selectable>{t('policies.refundGifts')}</Text>
            <Text selectable>{t('policies.refundExpired')}</Text>
          </View>
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  sections: { gap: spacing.xxl },
  section: { gap: spacing.md },
});
