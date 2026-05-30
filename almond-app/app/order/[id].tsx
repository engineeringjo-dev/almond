import { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusTimeline } from '@/components/order/StatusTimeline';
import { RatingSheet } from '@/components/order/RatingSheet';
import { colors, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useOrder, useAdvanceOrder } from '@/hooks/useOrder';
import { useCountdown } from '@/hooks/useCountdown';
import { useCartStore } from '@/stores/cartStore';
import type { CartItem } from '@/types';

export default function OrderTracking() {
  const { t, lang } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading, isError, refetch } = useOrder(id ?? '');
  const advance = useAdvanceOrder();
  const { label, done } = useCountdown(order?.targetReadyAt);
  const addLine = useCartStore((s) => s.addLine);
  const [ratingOpen, setRatingOpen] = useState(false);

  // Simulate the KDS advancing the order through the timeline (mock only).
  // The service holds 'received' until the 30s grace window passes (Part 3).
  useEffect(() => {
    if (!order || order.status === 'ready' || order.status === 'completed' || order.status === 'cancelled') return;
    const timer = setTimeout(() => advance.mutate(order.id), 6000);
    return () => clearTimeout(timer);
  }, [order, advance]);

  // Prompt for a branch rating once the order completes (section 4.10.2).
  useEffect(() => {
    if (order?.status === 'completed') setRatingOpen(true);
  }, [order?.status]);

  if (isLoading || isError || !order) {
    return <Screen loading={isLoading} error={isError || !order} onRetry={refetch} />;
  }

  const branchName = lang === 'ar' ? order.branchNameAr : order.branchNameEn;
  const showCountdown = order.status !== 'completed' && order.status !== 'cancelled' && !done;

  const reorder = () => {
    order.items.forEach((line: CartItem) => addLine({ ...line }));
    router.push('/(tabs)/cart');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('track.title'), headerBackTitle: t('common.back') }} />
      <Screen>
        <Card style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View>
              <Text variant="caption" color={colors.warmGray}>
                {t('track.orderNumber')}
              </Text>
              <Text variant="h2">{order.id.slice(-6).toUpperCase()}</Text>
            </View>
            <View style={styles.branch}>
              <Text variant="caption" color={colors.warmGray}>
                📍 {branchName}
              </Text>
            </View>
          </View>

          {showCountdown ? (
            <View style={styles.countdown}>
              <Text variant="caption" color={colors.warmGray}>
                {t('track.readyIn')}
              </Text>
              <Text variant="display" color={colors.gold}>
                {label}
              </Text>
            </View>
          ) : null}
        </Card>

        {order.status === 'cancelled' ? (
          <Card style={styles.cancelledCard}>
            <Text variant="h2" center color={colors.red}>
              {t('confirm.cancelled')}
            </Text>
          </Card>
        ) : (
          <Card style={styles.timelineCard}>
            <StatusTimeline status={order.status} />
          </Card>
        )}

        {order.status === 'completed' ? (
          <View style={styles.completedActions}>
            <Button title={t('track.reorder')} onPress={reorder} leadingEmoji="🔄" />
            <Pressable onPress={() => setRatingOpen(true)} hitSlop={8} style={styles.rateLink}>
              <Text variant="bodyBold" color={colors.brown}>
                ⭐ {t('track.rateTitle', { branch: branchName })}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </Screen>

      <RatingSheet
        visible={ratingOpen}
        onClose={() => setRatingOpen(false)}
        branchName={branchName}
        branchId={order.branchId}
        orderId={order.id}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerCard: { gap: spacing.lg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  branch: { alignItems: 'flex-end' },
  countdown: { alignItems: 'center', gap: spacing.xs },
  timelineCard: { marginTop: spacing.lg },
  cancelledCard: { marginTop: spacing.lg, paddingVertical: spacing.xl },
  completedActions: { marginTop: spacing.lg, gap: spacing.md },
  rateLink: { alignSelf: 'center', padding: spacing.sm },
});
