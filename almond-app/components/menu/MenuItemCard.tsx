import { Pressable, StyleSheet, View, Image } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, radius, spacing, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { iconForCategory } from '@/lib/productIcon';
import type { MenuItem } from '@/types';

interface Props {
  item: MenuItem;
  onPress: () => void;
}

/** Grid tile (2-col). Shows the lowest size price as "from". */
export function MenuItemCard({ item, onPress }: Props) {
  const { t, lang } = useI18n();
  const minPrice = Math.min(...item.sizes.map((s) => s.price));
  const soldOut = item.inStock === false;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      disabled={soldOut}
      accessibilityRole="button"
    >
      <View style={styles.thumb}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.photo} resizeMode="cover" />
        ) : (
          <Icon name={iconForCategory(item.categoryId)} size={44} color={colors.brown} strokeWidth={1.6} />
        )}
        {item.isBrunch ? (
          <View style={styles.brBadge}>
            <Text variant="caption" color={colors.dark} style={styles.brText}>
              BR
            </Text>
          </View>
        ) : null}
        {soldOut ? (
          <View style={styles.soldOut}>
            <Text variant="caption" color={colors.cream}>
              {t('menu.outOfStock')}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="bodyBold" numberOfLines={1}>
        {lang === 'ar' ? item.nameAr : item.nameEn}
      </Text>
      <Text variant="caption" color={colors.warmGray} numberOfLines={1}>
        {lang === 'ar' ? item.nameEn : item.nameAr}
      </Text>
      <Text variant="price" style={styles.price}>
        {item.sizes.length > 1 ? `${lang === 'ar' ? 'من ' : 'from '}` : ''}
        {formatJOD(minPrice, lang)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 2,
    ...shadow.card,
  },
  pressed: { opacity: 0.85 },
  thumb: {
    height: 96,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
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
    backgroundColor: 'rgba(28,18,8,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  price: { marginTop: spacing.xs },
});
