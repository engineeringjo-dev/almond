import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useOrder, useCancelOrder } from '@/hooks/useOrder';
import { useCartStore } from '@/stores/cartStore';
import { formatTime } from '@/lib/format';
import { CANCEL_WINDOW_SECONDS } from '@/services/order.service';
import type { CartItem } from '@/types';

export default function OrderConfirm() {
  const { t, lang } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order } = useOrder(id ?? '');
  const cancelOrder = useCancelOrder();
  const addLine = useCartStore((s) => s.addLine);
  const scale = useRef(new Animated.Value(0)).current;

  // 30s cancel/modify grace window (Master Pack Part 3).
  const [secondsLeft, setSecondsLeft] = useState(CANCEL_WINDOW_SECONDS);
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const canCancel = secondsLeft > 0 && order?.status === 'received';

  const doCancel = async (modify: boolean) => {
    if (!order) return;
    await cancelOrder.mutateAsync(order.id);
    if (modify) {
      order.items.forEach((line: CartItem) => addLine({ ...line }));
      router.replace('/(tabs)/cart');
    } else {
      router.replace('/(tabs)');
    }
  };

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Animated.View style={[styles.checkCircle, { transform: [{ scale }] }]}>
          <Text style={styles.check}>✓</Text>
        </Animated.View>

        <Text variant="h1" center style={styles.title}>
          {t('confirm.title')}
        </Text>

        {order ? (
          <View style={styles.details}>
            <Row label={t('confirm.orderNumber')} value={order.id.slice(-6).toUpperCase()} />
            <Row
              label={t('confirm.readyAt')}
              value={formatTime(order.targetReadyAt, lang)}
              highlight
            />
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        {canCancel ? (
          <View style={styles.cancelBox}>
            <Text variant="caption" color={colors.brown} center>
              ⏱️ {t('confirm.cancelWindow', { seconds: secondsLeft })}
            </Text>
            <View style={styles.cancelRow}>
              <Button
                title={t('confirm.modifyOrder')}
                variant="outline"
                onPress={() => doCancel(true)}
                style={styles.cancelBtn}
              />
              <Button
                title={t('confirm.cancelOrder')}
                variant="ghost"
                onPress={() => doCancel(false)}
                style={styles.cancelBtn}
              />
            </View>
          </View>
        ) : null}

        <Button
          title={t('confirm.trackOrder')}
          onPress={() => router.replace({ pathname: '/order/[id]', params: { id: id ?? '' } })}
        />
        <Button
          title={t('confirm.backHome')}
          variant="ghost"
          onPress={() => router.replace('/(tabs)')}
        />
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.row}>
      <Text variant="body" color={colors.warmGray}>
        {label}
      </Text>
      <Text variant={highlight ? 'h2' : 'bodyBold'} color={highlight ? colors.gold : colors.dark}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  checkCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  check: { fontSize: 64, color: colors.cream, lineHeight: 72 },
  title: { marginBottom: spacing.xl },
  details: {
    alignSelf: 'stretch',
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footer: { padding: spacing.xl, gap: spacing.sm },
  cancelBox: {
    backgroundColor: colors.neutralWarm,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cancelRow: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: { flex: 1 },
});
