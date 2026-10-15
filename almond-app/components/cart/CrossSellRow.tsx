import { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { iconForCategory } from '@/lib/productIcon';
import { getCartCrossSell, getComboUpsell } from '@/lib/recommendations';
import { quickAdd, quickAddPrice } from '@/lib/pairings';
import { comboGain, type PointsFor } from '@/lib/earnEstimate';
import { useCartStore } from '@/stores/cartStore';
import type { CartItem } from '@/types';
import { itemFromPrice } from '@almond/shared/menu';

/**
 * Cart cross-sell carousel (UX / Starbucks "complete your order"). Suggests
 * complementary items based on the cart contents; one tap adds them.
 */
export function CrossSellRow({ items, pointsFor }: { items: CartItem[]; pointsFor: PointsFor }) {
  const { t, lang } = useI18n();
  const addItem = useCartStore((s) => s.addItem);
  const [added, setAdded] = useState<Record<string, boolean>>({});

  // Golden rule §2.2 #2: show only 1–3 suggestions — more reduces conversion.
  const suggestions = getCartCrossSell(items, 3);
  const offer = getComboUpsell(items);
  // The order's points with the offered item and without, by the estimate the
  // summary shows — and no banner when the first is not the larger. The 50
  // replaces the pair's own points, so adding the item can LOWER the order's
  // points (lib/earnEstimate.ts comboGain has the measured case).
  const gain = offer ? comboGain(pointsFor, items, offer.item) : null;
  const upsell = offer && gain ? { ...offer, ...gain } : null;
  if (suggestions.length === 0 && !upsell) return null;

  // What the banner adds, named and priced BEFORE the tap. It used to show
  // only the offer and «أضف واكسب», so one tap put a 4.900 JOD item nobody had
  // seen into the basket at the payment step (audit P1).
  const comboName = upsell ? (lang === 'ar' ? upsell.item.nameAr : upsell.item.nameEn) : '';
  const comboPrice = upsell ? formatJOD(quickAddPrice(upsell.item), lang) : '';

  return (
    <View>
      <Text variant="title" style={styles.heading}>
        {t('cart.crossSellTitle')}
      </Text>

      {/* Combo upsell: add the missing half (drink↔food) for the combo bonus.
          The label said "50 points" while the dial said 25, and then
          «واكسب 50 نقطة» where adding the item lowered the order's points. It
          states the order's points with the item and without, now. */}
      {upsell ? (
        <Pressable
          style={styles.comboBanner}
          onPress={() => {
            quickAdd(addItem, upsell.item);
            setAdded((p) => ({ ...p, [upsell.item.id]: true }));
          }}
          accessibilityRole="button"
          accessibilityLabel={t('cart.comboAddItem', {
            count: upsell.after,
            name: comboName,
            price: comboPrice,
            points: upsell.after,
            before: upsell.before,
          })}
        >
          <Icon name="brunch" size={22} color={colors.dark} strokeWidth={1.9} />
          <View style={styles.comboText}>
            <Text variant="caption" color={colors.dark}>
              {/* `count` picks the Arabic plural («8 نقاط» / «50 نقطة»). */}
              {upsell.missing === 'food'
                ? t('cart.comboAddFood', { count: upsell.after, points: upsell.after, before: upsell.before })
                : t('cart.comboAddDrink', { count: upsell.after, points: upsell.after, before: upsell.before })}
            </Text>
            <Text variant="bodyBold" color={colors.dark}>
              {comboName}
            </Text>
          </View>
          {/* The button carries the price it commits to — «أضف · 2.500 د.أ»,
              the same shape as the item sheet's «أضف للسلة · …» — instead of
              «أضف واكسب», which named neither the thing nor its cost. The
              name sits beside it once; repeating it in the pill truncated. */}
          <View style={styles.comboCta}>
            <Text variant="caption" color={colors.onInk} style={styles.addLabel}>
              {added[upsell.item.id] ? t('menu.added') : t('cart.comboAddPrice', { price: comboPrice })}
            </Text>
          </View>
        </Pressable>
      ) : null}
      {suggestions.length > 0 ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {suggestions.map((item) => {
          const isAdded = added[item.id];
          const minPrice = itemFromPrice(item);
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
                <Text variant="caption" color={colors.onInk} style={styles.addLabel}>
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
  comboText: { flex: 1, gap: 2 },
  comboCta: {
    backgroundColor: colors.dark,
    borderRadius: radius.pill,
    minHeight: 44,
    justifyContent: 'center',
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
