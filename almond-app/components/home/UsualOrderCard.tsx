import { Image, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Icon } from '@/components/ui/Icon';
import { PhotoDim } from '@/components/ui/PhotoDim';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useMenuState } from '@/hooks/useMenuState';
import { useUsualOrder } from '@/hooks/useOrder';
import { useCartStore, lineUnitPrice } from '@/stores/cartStore';
import { iconForItem } from '@/lib/productIcon';
import { formatJOD } from '@/lib/format';
import { menuImage } from '@/lib/menuImage';
import { MIN_TOUCH_TARGET } from '@/lib/a11y';

/**
 * «طلبك المعتاد» — the order a member places most, back in the cart in one
 * tap (section 4.4 #3, 7.2), with a photograph of what is in it. Expert panel,
 * 2026-10-15: «اطلب مجدداً بصورة آخر طلب». Precedent: Starbucks' and Talabat's
 * "Order again", which show the item, not only its name.
 *
 * It renders nothing for a member with no orders yet, and carries its own
 * margin for that reason: a wrapper on Home would leave the gap behind.
 */
export function UsualOrderCard() {
  const { t, lang } = useI18n();
  const usual = useUsualOrder();
  const menu = useMenuState();
  const addLine = useCartStore((s) => s.addLine);

  if (!usual) return null;

  const names = usual.items
    .map((i) => {
      const name = lang === 'ar' ? i.nameAr : i.nameEn;
      return i.qty > 1 ? `${name} ×${i.qty}` : name;
    })
    .join(lang === 'ar' ? '، ' : ', ');
  const total = usual.items.reduce((s, i) => s + lineUnitPrice(i) * i.qty, 0);
  const photos = usual.items.map((i) => menu.items.find((m) => m.id === i.itemId)?.imageUrl).filter(Boolean);
  const addLabel = t('home.usualAdd', { total: formatJOD(total, lang) });

  const addAll = () => {
    usual.items.forEach((i) => addLine({ ...i }));
    router.push('/cart');
  };

  return (
    <View style={styles.block}>
      <Text variant="title" accessibilityRole="header" style={styles.heading}>
        {t('home.usualOrder')}
      </Text>
      <Pressable
        onPress={addAll}
        accessibilityRole="button"
        accessibilityLabel={`${t('home.usualOrder')} ${names} ${addLabel}`}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={[styles.photo, !photos[0] && styles.iconPhoto]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {photos[0] ? (
            <>
              <Image source={{ uri: menuImage(photos[0], 160) }} style={styles.image} resizeMode="contain" />
              <PhotoDim />
            </>
          ) : (
            <Icon name={iconForItem(usual.items[0]?.itemId ?? '')} size={32} color={colors.dark} strokeWidth={1.5} />
          )}
        </View>
        <View style={styles.words}>
          <Text variant="bodyBold">{names}</Text>
          <Text variant="caption" color={colors.warmGray}>{addLabel}</Text>
        </View>
        <View style={styles.add} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon name="plus" size={20} color={colors.dark} strokeWidth={1.8} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: spacing.lg },
  heading: { marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.75 },
  photo: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  iconPhoto: { backgroundColor: colors.neutralWarm },
  words: { flex: 1, minWidth: 0, gap: spacing.xs },
  add: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
