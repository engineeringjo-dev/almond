import { View, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useMemo, useState } from 'react';

import { Text } from '@/components/ui/Text';
import { cdnImage } from '@/lib/cdnImage';
import { Icon } from '@/components/ui/Icon';
import { ItemModal } from '@/components/menu/ItemModal';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { iconForCategory } from '@/lib/productIcon';
import { menuItems } from '@/services/seed';
import type { MenuItem } from '@/types';

export function FeaturedRow() {
  const { t, lang } = useI18n();
  const [selected, setSelected] = useState<MenuItem | null>(null);
  // A varied "most popular" set: the first item from each of several categories
  // (so it's not all drinks) — prefers items that have a photo.
  const items = useMemo<MenuItem[]>(() => {
    const byCat = new Map<string, MenuItem>();
    for (const it of menuItems) {
      if (!byCat.has(it.categoryId) && it.imageUrl) byCat.set(it.categoryId, it);
    }
    return [...byCat.values()].slice(0, 12);
  }, []);

  return (
    <View>
      <Text variant="title" style={styles.heading}>
        {t('home.popular')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() => setSelected(item)}
            accessibilityRole="button"
          >
            <View style={styles.thumb}>
              {item.imageUrl ? (
                <Image source={{ uri: cdnImage(item.imageUrl, 260) }} style={styles.photo} resizeMode="contain" />
              ) : (
                <Icon name={iconForCategory(item.categoryId)} size={46} color={colors.primary} strokeWidth={1.6} />
              )}
            </View>
            <Text variant="bodyBold" numberOfLines={1}>
              {lang === 'ar' ? item.nameAr : item.nameEn}
            </Text>
            <Text variant="price">
              {item.sizes.length > 1 ? (lang === 'ar' ? 'من ' : 'from ') : ''}
              {formatJOD(Math.min(...item.sizes.map((s) => s.price)), lang)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ItemModal item={selected} visible={!!selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: spacing.md },
  row: { gap: spacing.md, paddingEnd: spacing.lg },
  card: {
    width: 150,
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 2,
    ...shadow.card,
  },
  pressed: { opacity: 0.88 },
  thumb: {
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
});
