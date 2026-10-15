import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useActiveOrders } from '@/hooks/useOrder';
import { formatTime } from '@/lib/format';
import { Icon } from '@/components/ui/Icon';
import { STATUS_ICON } from '@/components/order/statusIcon';
import type { Order } from '@/types';

export default function TrackScreen() {
  const { t, lang } = useI18n();
  const { data: orders, isLoading, isError, refetch } = useActiveOrders();

  if (isLoading || isError) {
    return <Screen loading={isLoading} error={isError} onRetry={refetch} />;
  }

  if (!orders || orders.length === 0) {
    return (
      <Screen scroll={false}>
        <EmptyState
          icon="track"
          title={t('track.noOrders')}
          subtitle={t('track.noOrdersHint')}
          ctaLabel={t('track.noOrdersCta')}
          onCta={() => router.push('/(tabs)/order')}
        />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={refetch}>
      <View style={styles.titleRow}>
        <Text variant="h1" style={styles.title}>
          {t('track.title')}
        </Text>
      </View>
      <View style={styles.list}>
        {orders.map((o: Order) => (
          <Pressable
            key={o.id}
            onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.id } })}
            accessibilityRole="button"
          >
            <Card style={styles.row}>
              <View style={styles.statusBadge}>
                <Icon name={STATUS_ICON[o.status]} size={24} color={colors.dark} strokeWidth={1.75} />
              </View>
              <View style={styles.body}>
                <Text variant="bodyBold">
                  {t('track.orderNumber')} {o.id.slice(-6).toUpperCase()}
                </Text>
                <View style={styles.where}>
                  <Icon name="map-pin" size={13} color={colors.warmGray} />
                  <Text variant="caption" color={colors.warmGray} style={styles.flex}>
                    {lang === 'ar' ? o.branchNameAr : o.branchNameEn} · {t(`track.${o.status}`)}
                  </Text>
                </View>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  title: {},
  list: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statusBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  where: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flex: { flex: 1 },
  body: { flex: 1, gap: 2 },
  time: { alignItems: 'flex-end' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
});
