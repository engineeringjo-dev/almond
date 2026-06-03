import { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { iconForCategory } from '@/lib/productIcon';
import { getCartCrossSell, getBrunchCrossSell } from '@/lib/recommendations';
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

  // Golden rule §2.2 #2: show only 1–3 suggestions — more reduces conversion.
  const suggestions = getCartCrossSell(items, 3);
  const brunch = getBrunchCrossSell(items);
  if (suggestions.length === 0 && !brunch) return null;

  return (
    <View>
      <Text variant="title" style={styles.heading}>
        {t('cart.crossSellTitle')}
      </Text>

      {/* Smart brunch combo nudge (§2.3 #3): drink in cart, no BR → save 1 JOD */}
      {brunch ? (
        <Pressable
          style={styles.comboBanner}
          onPress={() => {
            addItem(brunch, brunch.sizes[0], [], 1);
            setAdded((p) => ({ ...p, [brunch.id]: true }));
          }}
          accessibilityRole="button"
        >
          <Text style={styles.comboEmoji}>🍳</Text>
          <Text variant="bodyBold" color={colors.dark} style={styles.comboText}>
            {t('cart.brunchComboTitle')}
          </Text>
          <View style={styles.comboCta}>
            <Text variant="caption" color={colors.dark} style={styles.addLabel}>
              {added[brunch.id] ? t('menu.added') : t('cart.addCombo')}
            </Text>
          </View>
        </Pressable>
      ) : null}
      {suggestions.length > 0 ? (
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: spacing.md },
  comboBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.lightGold,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  comboEmoji: { fontSize: 20 },
  comboText: { flex: 1 },
  comboCta: {
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
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
