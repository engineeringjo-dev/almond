import { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { HeroCard } from '@/components/ui/HeroCard';
import { Icon } from '@/components/ui/Icon';
import { StatusTimeline } from '@/components/order/StatusTimeline';
import { VisitRatingSheet } from '@/components/loyalty/VisitRatingSheet';
import { colors, spacing, radius, shadow } from '@/constants/theme';
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
    router.push('/cart');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('track.title'), headerBackTitle: t('common.back') }} />
      <Screen>
        <View style={styles.headerShadow}>
          <HeroCard style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View>
                <Text variant="caption" color={colors.onHero}>
                  {t('track.orderNumber')}
                </Text>
                <Text variant="h2" color={colors.onHero}>{order.id.slice(-6).toUpperCase()}</Text>
              </View>
              <View style={styles.branch}>
                <Icon name="map-pin" size={14} color={colors.onHero} />
                <Text variant="caption" color={colors.onHero}>
                  {branchName}
                </Text>
              </View>
            </View>

            {showCountdown ? (
              <View style={styles.countdown}>
                <Text variant="caption" color={colors.onHero}>
                  {t('track.readyIn')}
                </Text>
                <Text variant="display" color={colors.onHero}>
                  {label}
                </Text>
              </View>
            ) : null}
          </HeroCard>
        </View>

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
            <Button title={t('track.reorder')} onPress={reorder} leadingIcon="reorder" />
            <Pressable onPress={() => setRatingOpen(true)} hitSlop={8} style={styles.rateLink}>
              <Icon name="star" size={18} color={colors.brown} />
              <Text variant="bodyBold" color={colors.brown}>
                {t('track.rateTitle', { branch: branchName })}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </Screen>

      <VisitRatingSheet
        visible={ratingOpen}
        onClose={() => setRatingOpen(false)}
        branchName={branchName}
        visitRef={`order:${order.id}`}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerShadow: { borderRadius: radius.lg, ...shadow.card },
  headerCard: { gap: spacing.lg, borderRadius: radius.lg, padding: spacing.lg, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  branch: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  countdown: { alignItems: 'center', gap: spacing.xs },
  timelineCard: { marginTop: spacing.lg },
  cancelledCard: { marginTop: spacing.lg, paddingVertical: spacing.xl },
  completedActions: { marginTop: spacing.lg, gap: spacing.md },
  rateLink: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm },
});
