import { StyleSheet, Pressable, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatDate } from '@/lib/format';
import { useCartCount } from '@/stores/cartStore';
import { useLoyaltyBalance } from '@/hooks/useLoyalty';

const EXPIRY_WINDOW_DAYS = 14;

/**
 * Lifecycle nudge on Home (client-side; no backend needed). Shows the single
 * highest-value reminder: an abandoned cart (order recovery) or points about
 * to expire (retention). Renders nothing when neither applies.
 */
export function HomeNudge() {
  const { t, lang } = useI18n();
  const cartCount = useCartCount();
  const { data: balance } = useLoyaltyBalance();

  // 1) Abandoned cart — the persisted cart still has items.
  if (cartCount > 0) {
    return (
      <Nudge
        icon="cart"
        text={t('home.nudgeCart', { count: cartCount })}
        onPress={() => router.push('/(tabs)/cart')}
        isRTL={lang === 'ar'}
      />
    );
  }

  // 2) Points expiring within the window.
  if (balance?.beansExpireAt) {
    const days = Math.ceil((new Date(balance.beansExpireAt).getTime() - Date.now()) / 86400000);
    if (days >= 0 && days <= EXPIRY_WINDOW_DAYS) {
      return (
        <Nudge
          icon="bean"
          text={t('home.nudgeExpiry', { date: formatDate(balance.beansExpireAt, lang) })}
          onPress={() => router.push('/(tabs)/rewards')}
          isRTL={lang === 'ar'}
        />
      );
    }
  }

  return null;
}

function Nudge({
  icon,
  text,
  onPress,
  isRTL,
}: {
  icon: IconName;
  text: string;
  onPress: () => void;
  isRTL: boolean;
}) {
  return (
    <Pressable style={styles.wrap} onPress={onPress} accessibilityRole="button">
      <View style={styles.iconChip}>
        <Icon name={icon} size={18} color={colors.primary} strokeWidth={2} />
      </View>
      <Text variant="bodyBold" color={colors.dark} style={styles.text} numberOfLines={2}>
        {text}
      </Text>
      <Text variant="title" color={colors.primary}>
        {isRTL ? '‹' : '›'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.neutralWarm,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },
  iconChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
});
