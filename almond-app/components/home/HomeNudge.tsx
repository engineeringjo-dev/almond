import { StyleSheet, Pressable, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatDayKey } from '@/lib/format';
import { daysUntilDayKey } from '@almond/shared/loyalty/lots';
import { useCartCount } from '@/stores/cartStore';
import { useLoyaltyBalance } from '@/hooks/useLoyalty';

/** How close a slice of points must be to dying before the nudge fires.
 *  Under per-lot expiry this fires on a SLICE, several times a year and with
 *  something actionable to do about it ("spend these 40"), instead of once a
 *  year on a whole balance. */
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

  // 2) The next slice of points to die, if it is close.
  //
  // 🔴 DAY-KEY ARITHMETIC, NOT MILLISECONDS. `nextExpiry.on` is an Amman
  // calendar day, and `new Date('2026-11-15')` parses as UTC MIDNIGHT — so the
  // millisecond form both flips a day early on a host west of Greenwich and
  // renders the day BEFORE the one the server enforces. That is the exact class
  // of defect the ledger exists to prevent; it must not be reintroduced here.
  if (balance?.nextExpiry) {
    const days = daysUntilDayKey(balance.nextExpiry.on);
    if (days >= 0 && days <= EXPIRY_WINDOW_DAYS) {
      return (
        <Nudge
          icon="bean"
          text={t('home.nudgeExpiry', {
            points: balance.nextExpiry.amount,
            date: formatDayKey(balance.nextExpiry.on, lang),
          })}
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
