import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { Text } from '@/components/ui/Text';
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
    router.push(reward.type === 'spin' ? '/spin' : '/(tabs)/menu');
  };

  return (
    <Pressable style={styles.card} onPress={use} accessibilityRole="button">
      <Text style={styles.emoji}>{reward.type === 'spin' ? '🎡' : '🏷️'}</Text>
      <View style={styles.body}>
        <Text variant="bodyBold" color={colors.cream}>
          {title}
        </Text>
        <Text variant="caption" color={colors.lightGold}>
          {t('visitReward.validFor')} {label}
        </Text>
      </View>
      <View style={styles.cta}>
        <Text variant="bodyBold" color={colors.dark}>
          {t('visitReward.use')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.green,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  emoji: { fontSize: 28 },
  body: { flex: 1, gap: 2 },
  cta: {
    backgroundColor: colors.lightGold,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
