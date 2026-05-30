import { View, StyleSheet, Pressable } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { iconForCategory } from '@/lib/productIcon';
import { useCartStore } from '@/stores/cartStore';
import { menuItems } from '@/services/seed';
import type { CartItem } from '@/types';

/**
 * Smart pairing suggestion (UX §6 — personalization/upsell). Suggests a drink
 * when the cart has food only, or a pastry when it has drinks only.
 */
export function SuggestionRow({ items }: { items: CartItem[] }) {
  const { t, lang } = useI18n();
  const addItem = useCartStore((s) => s.addItem);

  const ids = new Set(items.map((i) => i.itemId));
  const hasDrink = items.some((i) => i.isDrink);
  const hasFood = items.some((i) => !i.isDrink);

  let suggestId: string | null = null;
  if (hasFood && !hasDrink) suggestId = 'latte';
  else if (hasDrink && !hasFood) suggestId = 'almond-croissant';

  // Don't suggest something already in the cart, or anything out of stock.
  const item =
    suggestId && !ids.has(suggestId)
      ? menuItems.find((i) => i.id === suggestId && i.inStock !== false)
      : undefined;
  if (!item) return null;

  const size = item.sizes[0];

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => addItem(item, size, [], 1)}
      accessibilityRole="button"
    >
      <View style={styles.thumb}>
        <Icon name={iconForCategory(item.categoryId)} size={22} color={colors.brown} strokeWidth={1.7} />
      </View>
      <View style={styles.body}>
        <Text variant="bodyBold" numberOfLines={1}>
          {t('cart.suggestion', { item: lang === 'ar' ? item.nameAr : item.nameEn })}
        </Text>
        <Text variant="caption" color={colors.warmGray}>
          {formatJOD(size.price, lang)}
        </Text>
      </View>
      <View style={styles.addBtn}>
        <Icon name="plus" size={18} color={colors.dark} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.neutralWarm,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  pressed: { opacity: 0.85 },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
