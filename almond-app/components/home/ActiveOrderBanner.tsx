import { StyleSheet, Pressable, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatTime } from '@/lib/format';
import { useActiveOrders } from '@/hooks/useOrder';
import type { Order, OrderStatus } from '@/types';

const STATUS_ICON: Record<OrderStatus, IconName> = {
  received: 'history',
  preparing: 'coffee',
  ready: 'navigation',
  completed: 'navigation',
  cancelled: 'close',
};

/**
 * Live active-order banner on Home (Starbucks "your order" front-and-centre):
 * surfaces the most recent in-progress order with its status + ready time, one
 * tap to the full tracking screen. Hidden when there's no active order.
 */
export function ActiveOrderBanner() {
  const { t, lang } = useI18n();
  const { data: orders } = useActiveOrders();

  const order: Order | undefined = orders?.[0];
  if (!order) return null;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/order/[id]', params: { id: order.id } })}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.iconWrap}>
        <Icon name={STATUS_ICON[order.status]} size={22} color={colors.lightGold} strokeWidth={2} />
      </View>
      <View style={styles.body}>
        <Text variant="caption" color={colors.cream}>
          {t('track.orderNumber')} {order.id.slice(-6).toUpperCase()}
        </Text>
        <Text variant="bodyBold" color={colors.white}>
          {t(`track.${order.status}`)}
        </Text>
      </View>
      <View style={styles.time}>
        <Text variant="caption" color={colors.cream}>
          {t('confirm.readyAt')}
        </Text>
        <Text variant="bodyBold" color={colors.lightGold}>
          {formatTime(order.targetReadyAt, lang)}
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
    backgroundColor: colors.dark,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  pressed: { opacity: 0.92 },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  time: { alignItems: 'flex-end', gap: 2 },
});
