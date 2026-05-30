import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useActiveOrders } from '@/hooks/useOrder';
import { formatTime } from '@/lib/format';
import type { Order } from '@/types';

const STATUS_EMOJI: Record<string, string> = {
  received: '🧾',
  preparing: '☕',
  ready: '✅',
  completed: '🎉',
};

export default function TrackScreen() {
  const { t, lang } = useI18n();
  const { data: orders, isLoading, isError, refetch } = useActiveOrders();

  if (isLoading || isError) {
    return <Screen loading={isLoading} error={isError} onRetry={refetch} />;
  }

  if (!orders || orders.length === 0) {
    return (
      <Screen scroll={false}>
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📍</Text>
          <Text variant="h2" center>
            {t('track.noOrders')}
          </Text>
          <Button
            title={t('track.noOrdersCta')}
            onPress={() => router.push('/(tabs)/menu')}
            fullWidth={false}
            variant="outline"
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen onRefresh={refetch}>
      <Text variant="h1" style={styles.title}>
        {t('track.title')}
      </Text>
      <View style={styles.list}>
        {orders.map((o: Order) => (
          <Pressable
            key={o.id}
            onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.id } })}
            accessibilityRole="button"
          >
            <Card style={styles.row}>
              <View style={styles.statusBadge}>
                <Text style={styles.statusEmoji}>{STATUS_EMOJI[o.status]}</Text>
              </View>
              <View style={styles.body}>
                <Text variant="bodyBold">
                  {t('track.orderNumber')} {o.id.slice(-6).toUpperCase()}
                </Text>
                <Text variant="caption" color={colors.warmGray}>
                  📍 {lang === 'ar' ? o.branchNameAr : o.branchNameEn} ·{' '}
                  {t(`track.${o.status}`)}
                </Text>
              </View>
              <View style={styles.time}>
                <Text variant="caption" color={colors.warmGray}>
                  {t('confirm.readyAt')}
                </Text>
                <Text variant="bodyBold" color={colors.gold}>
                  {formatTime(o.targetReadyAt, lang)}
                </Text>
              </View>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.lg },
  list: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statusBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusEmoji: { fontSize: 24 },
  body: { flex: 1, gap: 2 },
  time: { alignItems: 'flex-end' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyEmoji: { fontSize: 64 },
});
