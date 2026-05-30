import { ScrollView, StyleSheet, Pressable, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';

interface Promo {
  id: string;
  emoji: string;
  titleAr: string;
  titleEn: string;
  bg: string;
  onPress: () => void;
}

// DECISION: promotions are mock/static for MVP; in production these come from
// the admin campaign engine (section 14.1).
const promos: Promo[] = [
  { id: 'brunch', emoji: '🍳', titleAr: 'عرض البرانش — وفّر 1.000 د.أ', titleEn: 'Brunch combo — save 1.000 JOD', bg: colors.brown, onPress: () => router.push('/(tabs)/menu') },
  { id: 'friday', emoji: '☕', titleAr: '+50% نقاط كل جمعة ☕', titleEn: '+50% points every Friday ☕', bg: colors.dark, onPress: () => router.push('/loyalty') },
];

export function PromoCarousel() {
  const { t, lang } = useI18n();
  return (
    <View>
      <Text variant="title" style={styles.heading}>
        {t('home.promotions')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {promos.map((p) => (
          <Pressable
            key={p.id}
            style={[styles.card, { backgroundColor: p.bg }]}
            onPress={p.onPress}
            accessibilityRole="button"
          >
            <Text style={styles.emoji}>{p.emoji}</Text>
            <Text variant="bodyBold" color={p.bg === colors.gold ? colors.dark : colors.cream}>
              {lang === 'ar' ? p.titleAr : p.titleEn}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: spacing.md },
  row: { gap: spacing.md, paddingEnd: spacing.lg },
  card: {
    width: 240,
    height: 120,
    borderRadius: radius.lg,
    padding: spacing.lg,
    justifyContent: 'space-between',
    ...shadow.card,
  },
  emoji: { fontSize: 32 },
});
