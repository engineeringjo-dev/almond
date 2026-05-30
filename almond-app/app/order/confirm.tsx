import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useOrder } from '@/hooks/useOrder';
import { formatTime } from '@/lib/format';

export default function OrderConfirm() {
  const { t, lang } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order } = useOrder(id ?? '');
  const scale = useRef(new Animated.Value(0)).current;

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
});
