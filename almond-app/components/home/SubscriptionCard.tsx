import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Gradient } from '@/components/ui/Gradient';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD, formatDate } from '@/lib/format';
import { useSubscription, useSubscribe } from '@/hooks/useLoyalty';
import { useToastStore } from '@/stores/toastStore';

/**
 * "Almond Club" monthly subscription (the growth strategy's #1 repeat-visit
 * lever). Shows a subscribe CTA, or the member's status + drinks remaining today.
 */
export function SubscriptionCard() {
  const { t, lang } = useI18n();
  const plan = config.SUBSCRIPTION;
  const { data: sub } = useSubscription();
  const subscribe = useSubscribe();

  if (!plan.enabled) return null;

  const onSubscribe = () => {
    subscribe.mutate('wallet', {
      onError: () => useToastStore.getState().showError(t('club.needWallet')),
    });
  };

  // Active member — status + remaining today.
  if (sub?.active) {
    return (
      <View style={styles.shadow}>
        <Gradient preset="purple" style={styles.card}>
          <View style={styles.headerRow}>
            <Icon name="star" size={18} color={colors.white} strokeWidth={2.2} />
            <Text variant="bodyBold" color={colors.white}>
              {lang === 'ar' ? plan.labelAr : plan.labelEn} · {t('club.active')}
            </Text>
          </View>
          <Text variant="h2" color={colors.white}>
            {t('club.remaining', { count: sub.remainingToday })}
          </Text>
          {sub.renewsAt ? (
            <Text variant="caption" color={colors.white}>
              {t('club.renews', { date: formatDate(sub.renewsAt, lang) })}
            </Text>
          ) : null}
        </Gradient>
      </View>
    );
  }

  // Not subscribed — pitch + CTA.
  return (
    <View style={styles.shadow}>
      <Gradient preset="purple" style={styles.card}>
        <View style={styles.headerRow}>
          <Icon name="star" size={18} color={colors.white} strokeWidth={2.2} />
          <Text variant="bodyBold" color={colors.white}>
            {lang === 'ar' ? plan.labelAr : plan.labelEn}
          </Text>
        </View>
        <Text variant="bodyBold" color={colors.white} style={styles.pitch}>
          {t('club.pitch', { count: plan.drinksPerDay, price: formatJOD(plan.priceJod, lang) })}
        </Text>
        <Pressable style={styles.cta} onPress={onSubscribe} disabled={subscribe.isPending} accessibilityRole="button">
          {subscribe.isPending ? (
            <ActivityIndicator color={colors.dark} />
          ) : (
            <Text variant="bodyBold" color={colors.dark}>{t('club.subscribe')}</Text>
          )}
        </Pressable>
        <Pressable onPress={() => router.push('/profile/wallet')} hitSlop={8}>
          <Text variant="caption" color={colors.white} style={styles.topupHint}>
            {t('club.payFromWallet')}
          </Text>
        </Pressable>
      </Gradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { borderRadius: radius.xl, ...shadow.raised },
  card: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pitch: { marginTop: spacing.xs },
  cta: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  topupHint: { textAlign: 'center', opacity: 0.9 },
});
