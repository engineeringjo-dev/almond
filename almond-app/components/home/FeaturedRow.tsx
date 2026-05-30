import { View, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useState } from 'react';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { ItemModal } from '@/components/menu/ItemModal';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { iconForCategory } from '@/lib/productIcon';
import { menuItems } from '@/services/seed';
import type { MenuItem } from '@/types';

// Curated "most popular" selection (Master Pack §2.6 — horizontal section with
// large images; §Part2.5 personalization/suggestions).
const FEATURED_IDS = ['latte', 'iced-latte', 'cappuccino', 'matcha-iced', 'almond-croissant', 'cold-brew'];

export function FeaturedRow() {
  const { t, lang } = useI18n();
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const items = FEATURED_IDS.map((id) => menuItems.find((i) => i.id === id)).filter(
    (i): i is MenuItem => !!i,
  );

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
                <Image source={{ uri: item.imageUrl }} style={styles.photo} resizeMode="cover" />
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
    height: 110,
    borderRadius: radius.md,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
});
