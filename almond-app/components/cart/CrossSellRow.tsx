import { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { iconForCategory } from '@/lib/productIcon';
import { getCartCrossSell } from '@/lib/recommendations';
import { useCartStore } from '@/stores/cartStore';
import type { CartItem } from '@/types';

/**
 * Cart cross-sell carousel (UX / Starbucks "complete your order"). Suggests
 * complementary items based on the cart contents; one tap adds them.
 */
export function CrossSellRow({ items }: { items: CartItem[] }) {
  const { t, lang } = useI18n();
  const addItem = useCartStore((s) => s.addItem);
  const [added, setAdded] = useState<Record<string, boolean>>({});

  const suggestions = getCartCrossSell(items, 8);
  if (suggestions.length === 0) return null;

  return (
    <View>
      <Text variant="title" style={styles.heading}>
        {t('cart.crossSellTitle')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {suggestions.map((item) => {
          const isAdded = added[item.id];
          const minPrice = Math.min(...item.sizes.map((s) => s.price));
          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.thumb}>
                <Icon name={iconForCategory(item.categoryId)} size={34} color={colors.primary} strokeWidth={1.7} />
              </View>
              <Text variant="bodyBold" numberOfLines={1}>
                {lang === 'ar' ? item.nameAr : item.nameEn}
              </Text>
              <Text variant="price" style={styles.price}>
                {item.sizes.length > 1 ? (lang === 'ar' ? 'من ' : 'from ') : ''}
                {formatJOD(minPrice, lang)}
              </Text>
              <Pressable
                style={[styles.addBtn, isAdded && styles.addedBtn]}
                onPress={() => {
                  addItem(item, item.sizes[0], [], 1);
                  setAdded((p) => ({ ...p, [item.id]: true }));
                }}
              >
                <Text variant="caption" color={isAdded ? colors.white : colors.dark} style={styles.addLabel}>
                  {isAdded ? t('menu.added') : `+ ${t('common.add')}`}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: spacing.md },
  row: { gap: spacing.md, paddingEnd: spacing.lg },
  card: {
    width: 124,
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 2,
    ...shadow.card,
  },
  thumb: {
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  price: { marginBottom: spacing.sm },
  addBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  addedBtn: { backgroundColor: colors.green },
  addLabel: { fontWeight: '700' },
});
