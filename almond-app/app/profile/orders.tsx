import { View, StyleSheet, Pressable } from 'react-native';
import { router, Stack } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD, formatDate } from '@/lib/format';
import { useOrderHistory } from '@/hooks/useOrder';
import { useCartStore } from '@/stores/cartStore';
import type { Order, CartItem } from '@/types';

export default function OrdersHistory() {
  const { t, lang } = useI18n();
  const { data, isLoading, isError, refetch } = useOrderHistory();
  const addLine = useCartStore((s) => s.addLine);

  const reorder = (order: Order) => {
    order.items.forEach((line: CartItem) => addLine({ ...line }));
    router.push('/(tabs)/cart');
  };

  return (
    <>
      <Stack.Screen options={{ title: t('profile.orders') }} />
      <Screen loading={isLoading} error={isError} onRetry={refetch}>
        {data && data.length > 0 ? (
          <View style={styles.list}>
            {data.map((o: Order) => (
              <Card key={o.id} style={styles.card}>
                <View style={styles.row}>
                  <View style={styles.body}>
                    <Text variant="bodyBold">
                      {t('track.orderNumber')} {o.id.slice(-6).toUpperCase()}
                    </Text>
                    <Text variant="caption" color={colors.warmGray}>
                      {lang === 'ar' ? o.branchNameAr : o.branchNameEn} · {formatDate(o.createdAt, lang)}
                    </Text>
                    <Text variant="caption" color={colors.warmGray} numberOfLines={1}>
                      {o.items.map((i) => `${i.qty}× ${lang === 'ar' ? i.nameAr : i.nameEn}`).join('، ')}
                    </Text>
                  </View>
                  <Text variant="price">{formatJOD(o.total, lang)}</Text>
                </View>
                <Pressable onPress={() => reorder(o)} style={styles.reorder} hitSlop={6}>
                  <Text variant="bodyBold" color={colors.gold}>
                    🔄 {t('track.reorder')}
                  </Text>
                </Pressable>
              </Card>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="menu"
            title={t('profile.noOrders')}
            ctaLabel={t('track.noOrdersCta')}
            onCta={() => router.push('/(tabs)/order')}
          />
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  body: { flex: 1, gap: 2 },
  reorder: {
    alignSelf: 'flex-start',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutralWarm,
    width: '100%',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingTop: spacing.xxl },
  emptyEmoji: { fontSize: 56 },
});
