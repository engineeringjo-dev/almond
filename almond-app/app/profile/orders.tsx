import { View, StyleSheet, Pressable } from 'react-native';
import { useState } from 'react';
import { router, Stack } from 'expo-router';
import { canReorderSizes } from '@almond/shared/menu';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { colors, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD, formatDate } from '@/lib/format';
import { useOrderHistory } from '@/hooks/useOrder';
import { useMenuState } from '@/hooks/useMenuState';
import { useCartStore } from '@/stores/cartStore';
import type { Order } from '@/types';

export default function OrdersHistory() {
  const { t, lang } = useI18n();
  const { data, isLoading, isError, refetch } = useOrderHistory();
  const addOrder = useCartStore((s) => s.addOrder);
  const menu = useMenuState();
  const [sizeIssue, setSizeIssue] = useState<string | null>(null);

  const reorder = (order: Order) => {
    if (sizeIssue === order.id || !canReorderSizes(order.items, menu.items)) { router.push({ pathname: '/(tabs)/order', params: { tab: 'menu' } }); return; }
    if (!addOrder(order.items)) { setSizeIssue(order.id); return; }
    router.push('/cart');
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
                <Pressable onPress={() => reorder(o)} style={styles.reorder} hitSlop={6} accessibilityRole="button">
                  <Icon name="reorder" size={16} color={colors.dark} />
                  <Text variant="bodyBold" color={colors.dark}>
                    {t(sizeIssue === o.id || !canReorderSizes(o.items, menu.items) ? 'tabs.order' : 'track.reorder')}
                  </Text>
                </Pressable>
                {sizeIssue === o.id || !canReorderSizes(o.items, menu.items) ? <Text variant="caption" selectable>{t('cart.reorderSizeUnavailable')}</Text> : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    alignSelf: 'flex-start',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutralWarm,
    width: '100%',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingTop: spacing.xxl },
  emptyEmoji: { fontSize: 56 },
});
