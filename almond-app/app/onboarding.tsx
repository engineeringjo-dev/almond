import { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  FlatList,
  Pressable,
  ViewToken,
} from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useAppStore } from '@/stores/appStore';

interface Slide {
  emoji: string;
  titleKey: string;
  bodyKey: string;
}

const slides: Slide[] = [
  { emoji: '☕', titleKey: 'onboarding.slide1Title', bodyKey: 'onboarding.slide1Body' },
  { emoji: '⚡', titleKey: 'onboarding.slide2Title', bodyKey: 'onboarding.slide2Body' },
  { emoji: '🎁', titleKey: 'onboarding.slide3Title', bodyKey: 'onboarding.slide3Body' },
];

export default function Onboarding() {
  const { t, isRTL } = useI18n();
  const { width } = useWindowDimensions();
  const complete = useAppStore((s) => s.completeOnboarding);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  const isLast = index === slides.length - 1;

  const finish = () => {
    complete();
    router.replace('/(auth)/login');
  };

  const goNext = () => {
    if (isLast) finish();
    else listRef.current?.scrollToIndex({ index: index + 1 });
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.skip} onPress={finish} hitSlop={12}>
        <Text variant="caption" color={colors.warmGray}>
          {isRTL ? 'تخطّي' : 'Skip'}
        </Text>
      </Pressable>

      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(s) => s.titleKey}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.emojiCircle}>
              <Text style={styles.emoji}>{item.emoji}</Text>
            </View>
            <Text variant="h1" center style={styles.title}>
              {t(item.titleKey)}
            </Text>
            <Text variant="body" color={colors.warmGray} center>
              {t(item.bodyKey)}
            </Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((s, i) => (
            <View key={s.titleKey} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Button title={isLast ? t('onboarding.start') : t('common.next')} onPress={goNext} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  skip: { position: 'absolute', top: 60, end: spacing.lg, zIndex: 10, padding: spacing.sm },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emojiCircle: {
    width: 160, height: 160, borderRadius: 80, backgroundColor: colors.cardBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl,
  },
  emoji: { fontSize: 80 },
  title: { marginBottom: spacing.md },
  footer: { padding: spacing.xl, gap: spacing.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warmGray, opacity: 0.4 },
  dotActive: { backgroundColor: colors.gold, opacity: 1, width: 22 },
});
