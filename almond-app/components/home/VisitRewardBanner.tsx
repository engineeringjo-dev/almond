import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { Text } from '@/components/ui/Text';
import { Gradient } from '@/components/ui/Gradient';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useCountdown } from '@/hooks/useCountdown';
import { useActiveVisitReward } from '@/hooks/useNotifications';
import { notificationService } from '@/services/notification.service';
import { useUserId } from '@/stores/authStore';

/** Visit reward (section 14.3): countdown banner; expires automatically if unused. */
export function VisitRewardBanner() {
  const { t, lang } = useI18n();
  const userId = useUserId();
  const qc = useQueryClient();
  const { data: reward } = useActiveVisitReward();
  const { label, done } = useCountdown(reward?.expiresAt);

  if (!reward || done) return null;

  const title =
    reward.type === 'discount'
      ? t('visitReward.discountTitle', { value: reward.value })
      : t('visitReward.spinTitle');

  const use = async () => {
    await notificationService.redeemVisitReward(userId, reward.id);
    qc.invalidateQueries({ queryKey: ['rewards', 'visit', userId] });
    // Spin wheel removed; non-discount rewards open the rewards screen.
    router.push(reward.type === 'discount' ? '/(tabs)/order' : '/(tabs)/rewards');
  };

  return (
    <Pressable style={styles.shadow} onPress={use} accessibilityRole="button">
      <Gradient preset="purple" style={styles.card}>
        <Text style={styles.emoji}>🎁</Text>
        <View style={styles.body}>
          <Text variant="bodyBold" color={colors.white}>
            {title}
          </Text>
          <Text variant="caption" color={colors.white}>
            {t('visitReward.validFor')} {label}
          </Text>
        </View>
        <View style={styles.cta}>
          <Text variant="bodyBold" color="#000000">
            {t('visitReward.use')}
          </Text>
        </View>
      </Gradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: { borderRadius: radius.lg, ...shadow.card },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
    overflow: 'hidden',
  },
  emoji: { fontSize: 28 },
  body: { flex: 1, gap: 2 },
  cta: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
