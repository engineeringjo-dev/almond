import { memo, useState } from 'react';
import { Pressable, StyleSheet, View, Image, useWindowDimensions } from 'react-native';
import { Text } from '@/components/ui/Text';
import { menuImage } from '@/lib/menuImage';
import { PhotoDim } from '@/components/ui/PhotoDim';
import { Icon } from '@/components/ui/Icon';
import { colors, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { iconForCategory } from '@/lib/productIcon';
import { secondaryName } from '@/lib/itemName';
import type { MenuItem } from '@/types';
import { itemFromPrice } from '@almond/shared/menu';
import { menuPhotoHeight, menuPhotoPlacement } from '@/lib/menuList';

interface Props {
  item: MenuItem;
  onPress: () => void;
}

/** Grid tile (2-col). Shows the lowest size price as "from". */
function MenuItemCardBase({ item, onPress }: Props) {
  const { t, lang } = useI18n();
  const minPrice = itemFromPrice(item);
  const soldOut = item.inStock === false;
  const other = secondaryName(item, lang);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const hasPhoto = !!item.imageUrl && failedImage !== item.imageUrl;
  // Every tile the same height, so a menu row is a known height and a section
  // can be jumped to exactly (order.tsx): the name keeps room for its two
  // lines, and an English tile keeps its line for the Arabic name. Scaled
  // with the reader's text size, as the lines themselves are.
  const { width, fontScale } = useWindowDimensions();
  const photoHeight = menuPhotoHeight(width);
  const photo = menuPhotoPlacement(item.imageUrl, photoHeight);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      disabled={soldOut}
      accessibilityRole="button"
      accessibilityState={{ disabled: soldOut }}
      accessibilityLabel={t('common.withPrice', {
        name: lang === 'ar' ? item.nameAr : item.nameEn,
        price: item.sizes.length > 1
          ? t('menu.fromPrice', { price: formatJOD(minPrice, lang) })
          : formatJOD(minPrice, lang),
      })}
    >
      <View style={[styles.thumb, { height: photoHeight }, !hasPhoto && styles.thumbFallback]}>
        {hasPhoto ? (
          <View style={[styles.photoFrame, { width: photoHeight, height: photoHeight }]}>
            <Image
              source={{ uri: menuImage(item.imageUrl, 400) }}
              style={[styles.photo, {
                width: photo.size,
                height: photo.size,
                transform: [{ translateX: photo.translateX }, { translateY: photo.translateY }],
              }]}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
              onError={() => setFailedImage(item.imageUrl ?? null)}
            />
          </View>
        ) : (
          <Icon name={iconForCategory(item.categoryId)} size={44} color={colors.brown} strokeWidth={1.6} />
        )}
        {hasPhoto ? <PhotoDim /> : null}
        {item.isBrunch ? (
          <View style={styles.brBadge}>
            <Text variant="caption" color={colors.dark} style={styles.brText}>
              BR
            </Text>
          </View>
        ) : null}
        {soldOut ? (
          <View style={styles.soldOut}>
            <Text variant="caption" color={colors.white}>
              {t('menu.outOfStock')}
            </Text>
          </View>
        ) : null}
      </View>
      {/* A measured name block keeps section jumps exact. The full name is
          also the button's spoken label and opens without truncation. */}
      <Text variant="bodyBold" numberOfLines={2} style={{ minHeight: NAME_LINE * 2 * fontScale }}>
        {lang === 'ar' ? item.nameAr : item.nameEn}
      </Text>
      {lang !== 'ar' ? (
        <Text variant="caption" color={colors.warmGray} numberOfLines={1}>
          {other ?? ' '}
        </Text>
      ) : null}
      <Text variant="price" style={styles.price}>
        {item.sizes.length > 1
          ? t('menu.fromPrice', { price: formatJOD(minPrice, lang) })
          : formatJOD(minPrice, lang)}
      </Text>
    </Pressable>
  );
}

// Menu items are stable references from the query cache, so skip re-rendering a
// tile unless its item actually changes (e.g. while typing in search). Language
// changes still flow through the useI18n subscription inside the component.
export const MenuItemCard = memo(MenuItemCardBase, (prev, next) => prev.item === next.item);

/** The name's line height (components/ui/Text bodyBold). */
const NAME_LINE = 24;

const styles = StyleSheet.create({
  card: {
    flex: 1,
    // Daylight Counter: the owned photograph is the plane; copy sits on the
    // page. No outer card padding stealing width from the two-column photos.
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutralWarm,
  },
  pressed: { opacity: 0.85 },
  thumb: {
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  thumbFallback: { backgroundColor: colors.neutralWarm },
  photoFrame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { flexShrink: 0 },
  brBadge: {
    position: 'absolute',
    top: spacing.sm,
    start: spacing.sm,
    backgroundColor: colors.lightGold,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  brText: { fontWeight: '700' },
  soldOut: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  // Pinned to the tile's foot, so prices line up across a row whether or not
  // a tile has a second name line.
  price: { marginTop: 'auto', paddingTop: spacing.xs },
});
