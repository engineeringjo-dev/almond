import { ScrollView, StyleSheet, Pressable, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Gradient } from '@/components/ui/Gradient';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';

interface Promo {
  id: string;
  emoji: string;
  titleAr: string;
  titleEn: string;
  onPress: () => void;
}

// DECISION: promotions are mock/static for MVP; in production these come from
// the admin campaign engine (section 14.1).
const promos: Promo[] = [
  { id: 'friday', emoji: '☕', titleAr: '+50% نقاط كل جمعة ☕', titleEn: '+50% points every Friday ☕', onPress: () => router.push('/(tabs)/rewards') },
  { id: 'wallet', emoji: '👛', titleAr: 'اشحن محفظتك واكسب +50% نقاط', titleEn: 'Top up your wallet, earn +50% points', onPress: () => router.push('/profile/wallet') },
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
          <Pressable key={p.id} style={styles.shadow} onPress={p.onPress} accessibilityRole="button">
            <Gradient preset="purple" style={styles.card}>
              <Text style={styles.emoji}>{p.emoji}</Text>
              <Text variant="bodyBold" color={colors.white}>
                {lang === 'ar' ? p.titleAr : p.titleEn}
              </Text>
            </Gradient>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: spacing.md },
  row: { gap: spacing.md, paddingEnd: spacing.lg },
  shadow: { borderRadius: radius.lg, ...shadow.card },
  card: {
    width: 240,
    height: 120,
    borderRadius: radius.lg,
    padding: spacing.lg,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  emoji: { fontSize: 32 },
});
